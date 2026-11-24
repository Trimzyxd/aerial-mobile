import React, { useEffect, useState } from 'react'
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
  fetchDailyQuests,
  loadAutoRerollConfig,
  saveAutoRerollConfig,
  executeAutoReroll,
  evaluateBlacklist,
  DEFAULT_AUTOREROLL_CONFIG
} from '../api/daily-quests'
import { DailyQuest, EpicAccountSession, AutoRerollConfig, SavedAccount } from '../types'

interface QuestsScreenProps {
  session: EpicAccountSession | null
  accounts?: SavedAccount[]
  showGrandTotal?: boolean
  onOpenVault?: () => void
}

export const QuestsScreen: React.FC<QuestsScreenProps> = ({
  session,
  accounts,
  showGrandTotal,
  onOpenVault
}) => {
  const [quests, setQuests] = useState<DailyQuest[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [autoRerollConfig, setAutoRerollConfig] = useState<AutoRerollConfig>(DEFAULT_AUTOREROLL_CONFIG)
  const [showBlacklistModal, setShowBlacklistModal] = useState<boolean>(false)
  const [isAutoRerolling, setIsAutoRerolling] = useState<boolean>(false)

  const loadQuests = async () => {
    try {
      const cfg = await loadAutoRerollConfig()
      setAutoRerollConfig(cfg)
      const data = await fetchDailyQuests(session?.accessToken, session?.accountId)
      setQuests(data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadQuests()
  }, [session])

  const handleSaveConfig = async (newConfig: AutoRerollConfig) => {
    setAutoRerollConfig(newConfig)
    await saveAutoRerollConfig(newConfig)
    await loadQuests()
  }

  // Single button handler: checks all missions and replaces the blacklisted one
  const handleSingleAutoReplace = async () => {
    const blacklistedQuest = quests.find((q) => {
      const evalRes = evaluateBlacklist(q, autoRerollConfig)
      return evalRes.isBlacklisted
    })

    if (!blacklistedQuest) {
      Alert.alert(
        'All Clear',
        'None of your current daily missions match your blacklist rules.'
      )
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
        Alert.alert(
          'Replace Failed',
          'Could not replace mission. Check network connection or account session.'
        )
      }
      await loadQuests()
    } finally {
      setIsAutoRerolling(false)
    }
  }

  const totalQuestVbucks = quests.reduce((acc, q) => acc + q.vbucksReward, 0)
  const blacklistedCount = quests.filter((q) => q.isBlacklisted).length

  return (
    <View style={styles.container}>
      <Header
        title="Daily Quests"
        session={session}
        accounts={accounts}
        showGrandTotal={showGrandTotal}
        onOpenVault={onOpenVault}
      />

      {/* Stats Summary Bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Active Quests</Text>
          <Text style={styles.summaryValue}>{quests.length}</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryCol}>
          <Text style={styles.summaryLabel}>Potential V-Bucks</Text>
          <Text style={styles.summaryValueHighlight}>{totalQuestVbucks} V-Bucks</Text>
        </View>
      </View>

      {/* Single Auto-Replace Action Bar */}
      <View style={styles.actionSection}>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.singleAutoReplaceBtn, isAutoRerolling ? styles.btnDisabled : null]}
            onPress={handleSingleAutoReplace}
            disabled={isAutoRerolling}
            activeOpacity={0.8}
          >
            {isAutoRerolling ? (
              <ActivityIndicator size="small" color="#0d1017" />
            ) : (
              <>
                <Ionicons name="flash" size={16} color="#0d1017" />
                <Text style={styles.singleAutoReplaceBtnText}>
                  {blacklistedCount > 0
                    ? `Auto-Replace (${blacklistedCount} Blacklisted)`
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
          Checks daily quests against blacklist ({autoRerollConfig.blacklistedKeywords.length} keywords
          {autoRerollConfig.rerollLowVBucks ? ', 50 VB filter' : ''})
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Loading campaign profile...</Text>
        </View>
      ) : (
        <FlatList
          data={quests}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <QuestCard quest={item} />}
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
              {session ? (
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
        onRunNow={handleSingleAutoReplace}
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
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#161d2d',
    paddingVertical: 12,
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
    fontSize: 16,
    fontWeight: '700'
  },
  summaryValueHighlight: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '800'
  },
  actionSection: {
    backgroundColor: '#111726',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    padding: 16,
    paddingBottom: 24
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
    marginTop: 4
  }
})
