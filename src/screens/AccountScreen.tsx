import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Switch
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Header } from '../components/Header'
import {
  loginWithExchangeCode,
  logoutSession,
  switchActiveAccount,
  removeAccount,
  calculateGrandTotalVBucks
} from '../api/epic-auth'
import { EpicAccountSession, SavedAccount } from '../types'

interface AccountScreenProps {
  session: EpicAccountSession | null
  onSessionChange: (session: EpicAccountSession | null) => void
  accounts: SavedAccount[]
  onAccountsChange: (accounts: SavedAccount[]) => void
  showGrandTotal: boolean
  onToggleGrandTotal: (val: boolean) => void
  onOpenVault: () => void
}

export const AccountScreen: React.FC<AccountScreenProps> = ({
  session,
  onSessionChange,
  accounts,
  onAccountsChange,
  showGrandTotal,
  onToggleGrandTotal,
  onOpenVault
}) => {
  const [exchangeCode, setExchangeCode] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)

  const grandTotal = calculateGrandTotalVBucks(accounts)
  const activeVBucks = session?.vbucksDetail || {
    total: session?.vbucksBalance ?? 3450,
    complimentary: 2450,
    purchased: 1000
  }

  const handleLogin = async () => {
    if (!exchangeCode.trim()) {
      Alert.alert('Missing Code', 'Please paste a valid Epic Games exchange code.')
      return
    }

    setLoading(true)
    try {
      const newSession = await loginWithExchangeCode(exchangeCode.trim())
      if (newSession) {
        onSessionChange(newSession)
        setExchangeCode('')
        Alert.alert('Logged In', `Connected account: ${newSession.displayName}!`)
      } else {
        Alert.alert('Login Failed', 'Could not authenticate exchange code. Ensure it is not expired.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleSwitch = async (accountId: string) => {
    const switched = await switchActiveAccount(accountId)
    if (switched) {
      onSessionChange({
        accountId: switched.accountId,
        displayName: switched.displayName,
        accessToken: switched.accessToken,
        expiresAt: switched.expiresAt,
        vbucksBalance: switched.vbucks.total,
        vbucksDetail: switched.vbucks
      })
      const updated = accounts.map((a) => ({
        ...a,
        isActive: a.accountId === accountId
      }))
      onAccountsChange(updated)
    }
  }

  const handleRemove = async (accountId: string) => {
    const updated = await removeAccount(accountId)
    onAccountsChange(updated)
    const active = updated.find((a) => a.isActive) || updated[0] || null
    if (active) {
      onSessionChange({
        accountId: active.accountId,
        displayName: active.displayName,
        accessToken: active.accessToken,
        expiresAt: active.expiresAt,
        vbucksBalance: active.vbucks.total,
        vbucksDetail: active.vbucks
      })
    } else {
      onSessionChange(null)
    }
  }

  const openCodeUrl = () => {
    Linking.openURL(
      'https://www.epicgames.com/id/api/redirect?clientId=3446270ad57743c681c780b184e49e94&responseType=code'
    )
  }

  return (
    <View style={styles.container}>
      <Header
        title="Account"
        session={session}
        accounts={accounts}
        showGrandTotal={showGrandTotal}
        onOpenVault={onOpenVault}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Grand Total Across All Accounts Card */}
        <View style={styles.grandVaultCard}>
          <View style={styles.grandVaultHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={16} color="#fbbf24" />
              <Text style={styles.grandVaultTitle}>Total Across All Accounts</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{accounts.length} Accounts</Text>
            </View>
          </View>

          <Text style={styles.grandVaultNum}>
            {grandTotal.total.toLocaleString()} <Text style={styles.unitText}>V-Bucks</Text>
          </Text>

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>Earned (STW / BP)</Text>
              <Text style={styles.breakdownNumber}>+{grandTotal.complimentary.toLocaleString()}</Text>
            </View>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownCol}>
              <Text style={styles.breakdownLabel}>Purchased (Store)</Text>
              <Text style={styles.breakdownNumber}>+{grandTotal.purchased.toLocaleString()}</Text>
            </View>
          </View>

          <View style={styles.headerToggleBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleText}>Show Total in Top Bar</Text>
              <Text style={styles.toggleDesc}>Display combined V-Bucks sum across all accounts</Text>
            </View>
            <Switch
              value={showGrandTotal}
              onValueChange={onToggleGrandTotal}
              trackColor={{ false: '#334155', true: '#d97706' }}
              thumbColor={showGrandTotal ? '#fbbf24' : '#64748b'}
            />
          </View>
        </View>

        {/* Current Active Account Card */}
        <View style={styles.card}>
          <View style={styles.activeHeader}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color="#38bdf8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountTitle}>{session?.displayName || 'Commander'}</Text>
              <Text style={styles.accountIdText}>ID: {session?.accountId || 'demo-main-01'}</Text>
            </View>
            <View style={styles.statusPill}>
              <Ionicons name="checkmark-circle" size={13} color="#22c55e" />
              <Text style={styles.statusPillText}>ACTIVE</Text>
            </View>
          </View>

          {/* Active Account V-Bucks Detail */}
          <View style={styles.activeVBucksBox}>
            <Text style={styles.activeVBucksLabel}>Active Account Balance</Text>
            <Text style={styles.activeVBucksValue}>
              {activeVBucks.total.toLocaleString()} <Text style={{ fontSize: 13, color: '#fef3c7' }}>VB</Text>
            </Text>
            <View style={styles.activeVBucksSubRow}>
              <Text style={styles.activeVBucksSubItem}>
                STW Earned: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{activeVBucks.complimentary.toLocaleString()}</Text>
              </Text>
              <Text style={styles.activeVBucksSubItem}>
                Purchased: <Text style={{ color: '#ffffff', fontWeight: '700' }}>{activeVBucks.purchased.toLocaleString()}</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Multi-Account Switcher */}
        <Text style={styles.sectionHeader}>Saved Accounts ({accounts.length})</Text>

        {accounts.map((acc) => (
          <TouchableOpacity
            key={acc.accountId}
            style={[styles.accountItem, acc.isActive ? styles.accountItemActive : null]}
            onPress={() => !acc.isActive && handleSwitch(acc.accountId)}
            activeOpacity={0.7}
          >
            <View style={styles.accountItemLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.accountItemName}>{acc.displayName}</Text>
                {acc.isActive && (
                  <View style={styles.itemActivePill}>
                    <Text style={styles.itemActivePillText}>Active</Text>
                  </View>
                )}
              </View>
              <Text style={styles.accountItemVBucks}>
                {(acc.vbucks?.total || 0).toLocaleString()} VB · Earned: {(acc.vbucks?.complimentary || 0).toLocaleString()}
              </Text>
            </View>

            <View style={styles.accountItemRight}>
              {acc.isActive ? (
                <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
              ) : (
                <Ionicons name="radio-button-off" size={18} color="#64748b" />
              )}

              {accounts.length > 1 && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleRemove(acc.accountId)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={14} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {/* Add Another Account Section */}
        <View style={styles.card}>
          <Text style={styles.loginTitle}>Connect Another Epic Account</Text>
          <Text style={styles.loginSub}>
            Generate an exchange code to add secondary or alt accounts and track combined V-Bucks.
          </Text>

          <TouchableOpacity style={styles.linkBtn} onPress={openCodeUrl}>
            <Ionicons name="open-outline" size={14} color="#38bdf8" />
            <Text style={styles.linkBtnText}>Get Exchange Code in Browser</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Paste 32-character exchange code..."
            placeholderTextColor="#64748b"
            value={exchangeCode}
            onChangeText={setExchangeCode}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>+ Connect Account</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1017'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30
  },
  grandVaultCard: {
    backgroundColor: '#261804',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#b45309',
    marginBottom: 16
  },
  grandVaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  grandVaultTitle: {
    color: '#fef3c7',
    fontSize: 12,
    fontWeight: '700'
  },
  countBadge: {
    backgroundColor: '#451a03',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#78350f'
  },
  countBadgeText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '700'
  },
  grandVaultNum: {
    color: '#fbbf24',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 12
  },
  unitText: {
    fontSize: 15,
    color: '#fde68a',
    fontWeight: '700'
  },
  breakdownRow: {
    flexDirection: 'row',
    backgroundColor: '#191102',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'center'
  },
  breakdownLabel: {
    color: '#d4af37',
    fontSize: 10,
    marginBottom: 2
  },
  breakdownNumber: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  breakdownDivider: {
    width: 1,
    backgroundColor: '#523407',
    height: '80%',
    alignSelf: 'center'
  },
  headerToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1406',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4d3004'
  },
  toggleText: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '700'
  },
  toggleDesc: {
    color: '#a1885b',
    fontSize: 10,
    marginTop: 1
  },
  card: {
    backgroundColor: '#161b26',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#232b3d',
    marginBottom: 16
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1e2638',
    justifyContent: 'center',
    alignItems: 'center'
  },
  accountTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
  },
  accountIdText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f291e',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4
  },
  statusPillText: {
    color: '#86efac',
    fontSize: 10,
    fontWeight: '800'
  },
  activeVBucksBox: {
    backgroundColor: '#121824',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2a3e'
  },
  activeVBucksLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 2
  },
  activeVBucksValue: {
    color: '#fbbf24',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6
  },
  activeVBucksSubRow: {
    flexDirection: 'row',
    gap: 14
  },
  activeVBucksSubItem: {
    color: '#64748b',
    fontSize: 11
  },
  sectionHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8
  },
  accountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161b26',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#232b3d',
    marginBottom: 8
  },
  accountItemActive: {
    borderColor: '#0284c7',
    backgroundColor: '#121e2e'
  },
  accountItemLeft: {
    flex: 1
  },
  accountItemName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700'
  },
  itemActivePill: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4
  },
  itemActivePillText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800'
  },
  accountItemVBucks: {
    color: '#fbbf24',
    fontSize: 11,
    marginTop: 3
  },
  accountItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  switchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2942',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4
  },
  switchButtonText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700'
  },
  deleteButton: {
    padding: 4
  },
  loginTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4
  },
  loginSub: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c2742',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#0284c7',
    marginBottom: 10,
    alignSelf: 'flex-start',
    gap: 6
  },
  linkBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '600'
  },
  input: {
    backgroundColor: '#0f1420',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26344d',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    marginBottom: 12
  },
  loginBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  }
})
