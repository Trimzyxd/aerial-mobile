import React, { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Header } from '../components/Header'
import { QuestCard } from '../components/QuestCard'
import { BlacklistModal } from '../components/BlacklistModal'
import {
  fetchDailyQuestsWithStatus,
  fetchAllAccountsDailyQuests,
  loadAutoRerollConfig,
  saveAutoRerollConfig,
  executeAutoReroll,
  executeAutoRerollAllAccounts,
  rerollDailyQuest,
  evaluateBlacklist,
  DEFAULT_AUTOREROLL_CONFIG
} from '../api/daily-quests'
import {
  DailyQuest,
  EpicAccountSession,
  AutoRerollConfig,
  SavedAccount,
  AccountDailyQuestsGroup
} from '../types'

interface QuestsScreenProps {
  session: EpicAccountSession | null
  accounts?: SavedAccount[]
  showGrandTotal?: boolean
  onOpenVault?: () => void
  onSessionTokenRefreshed?: (accountId: string, accessToken: string) => void
}

export const QuestsScreen: React.FC<QuestsScreenProps> = ({
  session,
  accounts = [],
  showGrandTotal,
  onOpenVault,
  onSessionTokenRefreshed
}) => {
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'ALL'>('ACTIVE')
  const [quests, setQuests] = useState<DailyQuest[]>([])
  const [allAccountGroups, setAllAccountGroups] = useState<AccountDailyQuestsGroup[]>([])
  const [rerollsRemaining, setRerollsRemaining] = useState<number>(0)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [autoRerollConfig, setAutoRerollConfig] = useState<AutoRerollConfig>(DEFAULT_AUTOREROLL_CONFIG)
  const [showBlacklistModal, setShowBlacklistModal] = useState<boolean>(false)
  const [isAutoRerolling, setIsAutoRerolling] = useState<boolean>(false)
  const [rerollingQuestKey, setRerollingQuestKey] = useState<string | null>(null)

  const accountOrderKey = accounts.map((a) => a.accountId).join(',')

  const loadQuests = async () => {
    setFetchError(null)
    try {
      const cfg = await loadAutoRerollConfig()
      setAutoRerollConfig(cfg)

      if (viewMode === 'ALL') {
        if (accounts.length === 0) {
          setAllAccountGroups([])
          return
        }
        const { groups, refreshedTokens } = await fetchAllAccountsDailyQuests(accounts)
        setAllAccountGroups(groups)
        for (const [accId, token] of Object.entries(refreshedTokens)) {
          if (onSessionTokenRefreshed) {
            onSessionTokenRefreshed(accId, token)
          }
        }
      } else {
        const res = await fetchDailyQuestsWithStatus(session?.accessToken, session?.accountId)
        setQuests(res.quests)
        setRerollsRemaining(res.rerollsRemaining)
        setFetchError(res.error || null)
        if (res.refreshedAccessToken && session?.accountId && onSessionTokenRefreshed) {
          onSessionTokenRefreshed(session.accountId, res.refreshedAccessToken)
        }
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadQuests()
  }, [session?.accountId, session?.accessToken, viewMode, accountOrderKey])

  const handleSaveConfig = async (newConfig: AutoRerollConfig) => {
    setAutoRerollConfig(newConfig)
    await saveAutoRerollConfig(newConfig)
    await loadQuests()
  }

  const handleRerollSingle = async (accountId: string, quest: DailyQuest, displayName?: string) => {
    const key = `${accountId}:${quest.id}`
    setRerollingQuestKey(key)
    try {
      const targetAcc = accounts.find((a) => a.accountId === accountId)
      const token = session?.accountId === accountId ? session.accessToken : targetAcc?.accessToken
      const res = await rerollDailyQuest(quest.id, token, accountId)
      if (res.success) {
        Alert.alert(
          'Quest Rerolled',
          `${displayName ? `[${displayName}] ` : ''}Replaced "${quest.name}".`
        )
        await loadQuests()
      } else {
        Alert.alert('Reroll Failed', res.message)
      }
    } finally {
      setRerollingQuestKey(null)
    }
  }

  const handleAutoReplace = async () => {
    if (viewMode === 'ALL') {
      const candidateCount = allAccountGroups.reduce(
        (acc, g) =>
          acc +
          (g.rerollsRemaining > 0 && g.quests.some((q) => evaluateBlacklist(q, autoRerollConfig).isBlacklisted)
            ? 1
            : 0),
        0
      )

      if (candidateCount === 0) {
        const hasBlacklisted = allAccountGroups.some((g) =>
          g.quests.some((q) => evaluateBlacklist(q, autoRerollConfig).isBlacklisted)
        )
        Alert.alert(
          hasBlacklisted ? 'No Rerolls Remaining' : 'All Clear',
          hasBlacklisted
            ? 'Blacklisted quests were found, but those accounts have 0 daily rerolls remaining.'
            : 'None of the active daily quests across your accounts match your blacklist rules.'
        )
        return
      }

      setIsAutoRerolling(true)
      try {
        const summary = await executeAutoRerollAllAccounts(allAccountGroups, autoRerollConfig, accounts)
        if (summary.details.length === 0) {
          Alert.alert('Nothing Replaced', 'No eligible quests could be rerolled.')
        } else {
          const lines = summary.details.map((d) =>
            `${d.success ? '✓' : '✗'} ${d.accountName || 'Account'}: ${d.questName} (${
              d.success ? d.reason : d.message || 'Failed'
            })`
          )
          Alert.alert(
            `Auto-Replaced ${summary.rerolledCount} Quest(s)`,
            lines.join('\n')
          )
        }
        await loadQuests()
      } finally {
        setIsAutoRerolling(false)
      }
      return
    }

    // Active Account mode
    const blacklistedQuest = quests.find((q) => evaluateBlacklist(q, autoRerollConfig).isBlacklisted)
    if (!blacklistedQuest) {
      Alert.alert('All Clear', 'None of your current daily missions match your blacklist rules.')
      return
    }
    if (!blacklistedQuest.canReroll) {
      Alert.alert(
        'No Rerolls Remaining',
        `"${blacklistedQuest.name}" is blacklisted, but you have 0 daily rerolls remaining.`
      )
      return
    }

    setIsAutoRerolling(true)
    try {
      const summary = await executeAutoReroll(
        quests,
        autoRerollConfig,
        session?.accessToken,
        session?.accountId
      )
      if (summary.rerolledCount > 0) {
        const item = summary.details[0]
        Alert.alert(
          'Mission Auto-Replaced',
          `Successfully replaced "${item.questName}" (${item.reason})!`
        )
      } else {
        const firstErr = summary.details[0]?.message
        Alert.alert(
          'Replace Failed',
          firstErr || 'Could not replace mission. Check network connection or account session.'
        )
      }
      await loadQuests()
    } finally {
      setIsAutoRerolling(false)
    }
  }

  const allStats = useMemo(() => {
    let count = 0
    let vbucks = 0
    let blacklisted = 0
    let rerollableBlacklistedAccounts = 0

    for (const g of allAccountGroups) {
      let accountHasBlacklisted = false
      for (const q of g.quests) {
        count++
        vbucks += q.vbucksReward
        if (q.isBlacklisted) {
          blacklisted++
          accountHasBlacklisted = true
        }
      }
      if (accountHasBlacklisted && g.rerollsRemaining > 0) {
        rerollableBlacklistedAccounts++
      }
    }
    return { count, vbucks, blacklisted, rerollableBlacklistedAccounts }
  }, [allAccountGroups])

  const totalQuestVbucks = quests.reduce((acc, q) => acc + q.vbucksReward, 0)
  const blacklistedCount = quests.filter((q) => q.isBlacklisted).length

  const displayedCount = viewMode === 'ALL' ? allStats.count : quests.length
  const displayedVBucks = viewMode === 'ALL' ? allStats.vbucks : totalQuestVbucks
  const displayedBlacklisted = viewMode === 'ALL' ? allStats.blacklisted : blacklistedCount

  return (
    <View style={styles.container}>
      <Header
        title="Daily Quests"
        session={session}
        accounts={accounts}
        showGrandTotal={showGrandTotal}
        onOpenVault={onOpenVault}
      />

      {/* Active Account vs All Accounts Switcher */}
      <View style={styles.modeSwitcherBar}>
        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'ACTIVE' ? styles.modeTabActive : null]}
          onPress={() => setViewMode('ACTIVE')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="person"
            size={13}
            color={viewMode === 'ACTIVE' ? '#0d1017' : '#94a3b8'}
          />
          <Text style={[styles.modeTabText, viewMode === 'ACTIVE' ? styles.modeTabTextActive : null]}>
            Active ({session?.displayName || 'None'})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'ALL' ? styles.modeTabActive : null]}
          onPress={() => setViewMode('ALL')}
          activeOpacity={0.8}
        >
          <Ionicons
            name="people"
            size={14}
            color={viewMode === 'ALL' ? '#0d1017' : '#94a3b8'}
          />
          <Text style={[styles.modeTabText, viewMode === 'ALL' ? styles.modeTabTextActive : null]}>
            All Accounts ({accounts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>
            {viewMode === 'ALL' ? `Quests (${allAccountGroups.length} Accs)` : 'Active Quests'}
          </Text>
          <Text style={styles.summaryValue}>
            {displayedCount}{' '}
            {viewMode === 'ACTIVE' && session ? `(${rerollsRemaining} Rerolls)` : ''}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Potential V-Bucks</Text>
          <Text style={styles.summaryValueHighlight}>{displayedVBucks.toLocaleString()} V-Bucks</Text>
        </View>
      </View>

      {/* Auto-Replace Action Bar */}
      <View style={styles.actionSection}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.singleAutoReplaceBtn, isAutoRerolling ? styles.btnDisabled : null]}
            onPress={handleAutoReplace}
            disabled={isAutoRerolling}
            activeOpacity={0.8}
          >
            {isAutoRerolling ? (
              <ActivityIndicator size="small" color="#0d1017" />
            ) : (
              <>
                <Ionicons name="flash" size={16} color="#0d1017" />
                <Text style={styles.singleAutoReplaceBtnText}>
                  {viewMode === 'ALL'
                    ? displayedBlacklisted > 0
                      ? `Auto-Replace All Accounts (${displayedBlacklisted})`
                      : 'Auto-Replace All Accounts'
                    : displayedBlacklisted > 0
                    ? `Auto-Replace (${displayedBlacklisted} Blacklisted)`
                    : 'Auto-Replace Daily Missions'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsIconBtn}
            onPress={() => setShowBlacklistModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-sharp" size={18} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        <Text style={styles.ruleSubtext}>
          Blacklist: {autoRerollConfig.blacklistedTemplates.length} quests picked
          {autoRerollConfig.blacklistedKeywords.length > 0
            ? `, ${autoRerollConfig.blacklistedKeywords.length} keywords`
            : ''}
          {autoRerollConfig.rerollLowVBucks ? ', 100 VB filter' : ''}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>
            {viewMode === 'ALL'
              ? `Loading quests across ${accounts.length} account(s)...`
              : 'Loading campaign profile...'}
          </Text>
        </View>
      ) : viewMode === 'ALL' ? (
        <FlatList
          data={allAccountGroups}
          keyExtractor={(item) => item.accountId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadQuests()
              }}
              tintColor="#38bdf8"
            />
          }
          renderItem={({ item, index }) => {
            const groupVB = item.quests.reduce((acc, q) => acc + q.vbucksReward, 0)
            return (
              <View style={styles.accountGroupContainer}>
                <View style={styles.accountGroupHeader}>
                  <View style={styles.accountGroupLeft}>
                    <Text style={styles.accountGroupIndex}>#{index + 1}</Text>
                    <Text style={styles.accountGroupName} numberOfLines={1}>
                      {item.displayName}
                    </Text>
                    {session?.accountId === item.accountId && (
                      <View style={styles.activeTagPill}>
                        <Text style={styles.activeTagPillText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.accountGroupRight}>
                    <Text style={styles.accountGroupReroll}>Rerolls: {item.rerollsRemaining}</Text>
                    <Text style={styles.accountGroupVB}>+{groupVB} VB</Text>
                  </View>
                </View>

                {item.error ? (
                  <View style={styles.groupErrorBox}>
                    <Ionicons name="warning-outline" size={16} color="#f59e0b" />
                    <Text style={styles.groupErrorText}>{item.error}</Text>
                  </View>
                ) : item.quests.length === 0 ? (
                  <View style={styles.groupEmptyBox}>
                    <Text style={styles.groupEmptyText}>No active daily quests (cleared).</Text>
                  </View>
                ) : (
                  item.quests.map((q) => (
                    <QuestCard
                      key={`${item.accountId}-${q.id}`}
                      quest={q}
                      onReroll={() => handleRerollSingle(item.accountId, q, item.displayName)}
                      rerolling={rerollingQuestKey === `${item.accountId}:${q.id}`}
                    />
                  ))
                )}
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="person-circle-outline" size={40} color="#64748b" />
              <Text style={styles.emptyTitle}>No Accounts Saved</Text>
              <Text style={styles.emptySub}>Connect Epic accounts in the Account tab to view all quests.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={quests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <QuestCard
              quest={item}
              onReroll={
                session ? () => handleRerollSingle(session.accountId, item) : undefined
              }
              rerolling={session ? rerollingQuestKey === `${session.accountId}:${item.id}` : false}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadQuests()
              }}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {fetchError ? (
                <>
                  <Ionicons name="warning-outline" size={40} color="#f59e0b" />
                  <Text style={styles.emptyTitle}>Could Not Load Quests</Text>
                  <Text style={styles.emptySub}>{fetchError}</Text>
                  <TouchableOpacity
                    style={[styles.singleAutoReplaceBtn, { marginTop: 14, paddingHorizontal: 18 }]}
                    onPress={() => {
                      setLoading(true)
                      loadQuests()
                    }}
                  >
                    <Ionicons name="refresh" size={15} color="#0d1017" />
                    <Text style={styles.singleAutoReplaceBtnText}>Retry</Text>
                  </TouchableOpacity>
                </>
              ) : session ? (
                <>
                  <Ionicons name="checkmark-circle-outline" size={40} color="#22c55e" />
                  <Text style={styles.emptyTitle}>All Daily Quests Cleared!</Text>
                  <Text style={styles.emptySub}>Next daily quest arrives at UTC 00:00.</Text>
                </>
              ) : (
                <>
                  <Ionicons name="person-circle-outline" size={40} color="#64748b" />
                  <Text style={styles.emptyTitle}>No Account Connected</Text>
                  <Text style={styles.emptySub}>Sign in on the Account tab to view and manage daily quests.</Text>
                </>
              )}
            </View>
          }
        />
      )}

      {/* Blacklist Rules Modal */}
      <BlacklistModal
        visible={showBlacklistModal}
        config={autoRerollConfig}
        onClose={() => setShowBlacklistModal(false)}
        onSave={handleSaveConfig}
        onRunNow={handleAutoReplace}
        isRunning={isAutoRerolling}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1017'
  },
  modeSwitcherBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#101521',
    borderBottomWidth: 1,
    borderBottomColor: '#1d2638',
    gap: 8
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#171f30',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#25324a',
    gap: 6
  },
  modeTabActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#7dd3fc'
  },
  modeTabText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700'
  },
  modeTabTextActive: {
    color: '#0d1017',
    fontWeight: '800'
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#161d2d',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#202b3f'
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center'
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#26344d',
    alignSelf: 'center'
  },
  summaryLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2
  },
  summaryValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700'
  },
  summaryValueHighlight: {
    color: '#f59e0b',
    fontSize: 15,
    fontWeight: '800'
  },
  actionSection: {
    backgroundColor: '#111726',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  singleAutoReplaceBtn: {
    flex: 1,
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8
  },
  singleAutoReplaceBtnText: {
    color: '#0d1017',
    fontSize: 13,
    fontWeight: '800'
  },
  btnDisabled: {
    opacity: 0.6
  },
  settingsIconBtn: {
    backgroundColor: '#1e293b',
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center'
  },
  ruleSubtext: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center'
  },
  listContent: {
    padding: 14,
    paddingBottom: 28
  },
  accountGroupContainer: {
    backgroundColor: '#111622',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#212b3f',
    marginBottom: 14
  },
  accountGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1d273b'
  },
  accountGroupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    marginRight: 8
  },
  accountGroupIndex: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800'
  },
  accountGroupName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1
  },
  activeTagPill: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  activeTagPillText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800'
  },
  accountGroupRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  accountGroupReroll: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  accountGroupVB: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800'
  },
  groupErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#251c0a',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#78350f'
  },
  groupErrorText: {
    color: '#fde68a',
    fontSize: 12,
    flex: 1
  },
  groupEmptyBox: {
    paddingVertical: 10,
    alignItems: 'center'
  },
  groupEmptyText: {
    color: '#64748b',
    fontSize: 12
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#64748b',
    marginTop: 10,
    fontSize: 13
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center'
  },
  emptyTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center'
  }
})
