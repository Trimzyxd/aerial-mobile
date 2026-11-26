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
import * as Updates from 'expo-updates'
import { Header } from '../components/Header'
import {
  loginWithCode,
  logoutSession,
  switchActiveAccount,
  removeAccount,
  reorderAccounts,
  calculateGrandTotalVBucks,
  fetchAccountVbucks,
  loadAllAccounts,
  saveAllAccounts,
  EPIC_LOGIN_AUTH_URL,
  EPIC_LOGIN_FALLBACK_URL
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
  const [authInput, setAuthInput] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshingBalance, setRefreshingBalance] = useState<boolean>(false)
  const [checkingOta, setCheckingOta] = useState<boolean>(false)

  const handleCheckOtaUpdate = async () => {
    if (!Updates.isEnabled) {
      Alert.alert('OTA Disabled', 'Over-the-air updates require a release build with updates enabled.')
      return
    }
    setCheckingOta(true)
    try {
      const check = await Updates.checkForUpdateAsync()
      if (!check.isAvailable) {
        Alert.alert('Up to Date', 'You are running the latest version of Aerial Mobile.')
        return
      }
      await Updates.fetchUpdateAsync()
      Alert.alert(
        'Update Downloaded',
        'A new update has been downloaded. Restart now to apply?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart Now', onPress: () => Updates.reloadAsync() }
        ]
      )
    } catch (err: any) {
      Alert.alert('Update Check Failed', err?.message || 'Could not reach GitHub OTA endpoint.')
    } finally {
      setCheckingOta(false)
    }
  }

  const grandTotal = calculateGrandTotalVBucks(accounts)
  const activeVBucks = session?.vbucksDetail || {
    total: session?.vbucksBalance ?? 0,
    complimentary: 0,
    purchased: 0
  }

  const handleConnect = async () => {
    if (!authInput.trim()) {
      Alert.alert('Missing Input', 'Please paste the 32-character code or full redirect URL from Epic Games.')
      return
    }

    setLoading(true)
    try {
      const res = await loginWithCode(authInput.trim())
      if (res.success && res.session) {
        onSessionChange(res.session)
        const updatedAccounts = await loadAllAccounts()
        onAccountsChange(updatedAccounts)
        setAuthInput('')
        Alert.alert('Account Connected!', `Welcome, ${res.session.displayName}! Permanent device auth active.`)
      } else {
        Alert.alert(
          'Authentication Failed',
          res.error || 'Could not verify code. Please generate a fresh login code and try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRefreshBalance = async () => {
    if (!session) return
    setRefreshingBalance(true)
    try {
      const vbucks = await fetchAccountVbucks(session.accessToken, session.accountId)
      const updatedSession: EpicAccountSession = {
        ...session,
        vbucksBalance: vbucks.total,
        vbucksDetail: vbucks
      }
      onSessionChange(updatedSession)
      const all = await loadAllAccounts()
      const updatedAll = all.map((a) =>
        a.accountId === session.accountId ? { ...a, vbucks } : a
      )
      await saveAllAccounts(updatedAll)
      onAccountsChange(updatedAll)
      Alert.alert('Balance Updated', `Live balance: ${vbucks.total.toLocaleString()} V-Bucks`)
    } catch {
      Alert.alert('Error', 'Could not refresh V-Bucks balance.')
    } finally {
      setRefreshingBalance(false)
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
        vbucksBalance: switched.vbucks?.total || 0,
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
    Alert.alert('Remove Account', 'Are you sure you want to remove this account from Aerial?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = await removeAccount(accountId)
          onAccountsChange(updated)
          const active = updated.find((a) => a.isActive) || updated[0] || null
          if (active) {
            onSessionChange({
              accountId: active.accountId,
              displayName: active.displayName,
              accessToken: active.accessToken,
              expiresAt: active.expiresAt,
              vbucksBalance: active.vbucks?.total || 0,
              vbucksDetail: active.vbucks
            })
          } else {
            onSessionChange(null)
          }
        }
      }
    ])
  }

  const handleMoveAccount = async (fromIndex: number, toIndex: number) => {
    const updated = await reorderAccounts(fromIndex, toIndex, accounts)
    onAccountsChange(updated)
  }

  const handleLogout = async () => {
    Alert.alert('Log Out', 'Disconnect all accounts and log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logoutSession()
          await saveAllAccounts([])
          onSessionChange(null)
          onAccountsChange([])
        }
      }
    ])
  }

  const openAuthUrl = () => {
    Linking.openURL(EPIC_LOGIN_AUTH_URL)
  }

  const openFallbackUrl = () => {
    Linking.openURL(EPIC_LOGIN_FALLBACK_URL)
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
        {/* State A: No Accounts Connected */}
        {accounts.length === 0 || !session ? (
          <View>
            <View style={styles.onboardHero}>
              <View style={styles.iconCircle}>
                <Ionicons name="game-controller" size={32} color="#38bdf8" />
              </View>
              <Text style={styles.onboardTitle}>Connect Epic Games Account</Text>
              <Text style={styles.onboardSubtitle}>
                Sign in to view your live STW mission alerts, daily quests, auto-reroll, item shop, and friends list.
              </Text>
            </View>

            {/* Step 1 Card */}
            <View style={styles.stepCard}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 1</Text>
              </View>
              <Text style={styles.stepTitle}>Authorize Epic Games Account</Text>
              <Text style={styles.stepDesc}>
                Tap below to open the Epic Games login portal in your browser. Log in and confirm authorization.
              </Text>

              <TouchableOpacity style={styles.primaryAuthBtn} onPress={openAuthUrl} activeOpacity={0.8}>
                <Ionicons name="open-outline" size={18} color="#ffffff" />
                <Text style={styles.primaryAuthBtnText}>1. Open Epic Games Login</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={openFallbackUrl} style={{ marginTop: 8 }}>
                <Text style={styles.fallbackLinkText}>Having trouble? Try Alternative Login Link</Text>
              </TouchableOpacity>
            </View>

            {/* Step 2 Card */}
            <View style={styles.stepCard}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 2</Text>
              </View>
              <Text style={styles.stepTitle}>Paste Redirect Code or URL</Text>
              <Text style={styles.stepDesc}>
                After logging in, copy the full URL from the browser address bar (or the 32-character code) and paste it below:
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Paste full URL or 32-character code..."
                placeholderTextColor="#64748b"
                value={authInput}
                onChangeText={setAuthInput}
                autoCapitalize="none"
                autoCorrect={false}
                multiline={false}
              />

              <TouchableOpacity
                style={[styles.connectBtn, loading ? styles.connectBtnDisabled : null]}
                onPress={handleConnect}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="link" size={16} color="#ffffff" />
                    <Text style={styles.connectBtnText}>2. Connect Account</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Security Callout */}
            <View style={styles.infoBanner}>
              <Ionicons name="shield-checkmark" size={18} color="#22c55e" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoBannerTitle}>Permanent Device Auth & Local Security</Text>
                <Text style={styles.infoBannerText}>
                  Aerial creates permanent Device Auth credentials directly with Epic Games. Sessions refresh automatically in the background without needing to log in again. All tokens are encrypted securely on this device.
                </Text>
              </View>
            </View>
          </View>
        ) : (
          /* State B: Logged In Account Dashboard */
          <View>
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
                  <Text style={styles.accountTitle}>{session.displayName}</Text>
                  <Text style={styles.accountIdText}>ID: {session.accountId}</Text>
                </View>
                <View style={styles.statusPill}>
                  <Ionicons name="shield-checkmark" size={13} color="#22c55e" />
                  <Text style={styles.statusPillText}>DEVICE AUTH</Text>
                </View>
              </View>

              {/* Active Account V-Bucks Detail */}
              <View style={styles.activeVBucksBox}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.activeVBucksLabel}>Active Account Balance</Text>
                  <TouchableOpacity
                    style={styles.refreshBalanceBtn}
                    onPress={handleRefreshBalance}
                    disabled={refreshingBalance}
                  >
                    {refreshingBalance ? (
                      <ActivityIndicator size="small" color="#38bdf8" />
                    ) : (
                      <>
                        <Ionicons name="sync" size={12} color="#38bdf8" />
                        <Text style={styles.refreshBalanceText}>Refresh</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
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

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={14} color="#ef4444" />
                <Text style={styles.logoutBtnText}>Log Out All Accounts</Text>
              </TouchableOpacity>
            </View>

            {/* Multi-Account Switcher & Reordering */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Saved Accounts ({accounts.length})</Text>
              {accounts.length > 1 && (
                <Text style={styles.reorderHint}>Use arrows to reorder list</Text>
              )}
            </View>

            {accounts.map((acc, index) => (
              <View
                key={acc.accountId}
                style={[styles.accountItem, acc.isActive ? styles.accountItemActive : null]}
              >
                <TouchableOpacity
                  style={styles.accountItemLeft}
                  onPress={() => !acc.isActive && handleSwitch(acc.accountId)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.orderIndex}>#{index + 1}</Text>
                    <Text style={styles.accountItemName}>{acc.displayName}</Text>
                    {acc.isActive ? (
                      <View style={styles.itemActivePill}>
                        <Text style={styles.itemActivePillText}>Active</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.accountItemVBucks}>
                    {(acc.vbucks?.total || 0).toLocaleString()} VB · Earned: {(acc.vbucks?.complimentary || 0).toLocaleString()}
                  </Text>
                </TouchableOpacity>

                <View style={styles.accountItemRight}>
                  {accounts.length > 1 && (
                    <View style={styles.reorderControls}>
                      {index > 0 && (
                        <TouchableOpacity
                          style={styles.reorderBtn}
                          onPress={() => handleMoveAccount(index, 0)}
                          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        >
                          <Ionicons name="arrow-up-circle-outline" size={17} color="#38bdf8" />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.reorderBtn, index === 0 ? styles.reorderBtnDisabled : null]}
                        onPress={() => handleMoveAccount(index, index - 1)}
                        disabled={index === 0}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={17}
                          color={index === 0 ? '#334155' : '#cbd5e1'}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.reorderBtn,
                          index === accounts.length - 1 ? styles.reorderBtnDisabled : null
                        ]}
                        onPress={() => handleMoveAccount(index, index + 1)}
                        disabled={index === accounts.length - 1}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={17}
                          color={index === accounts.length - 1 ? '#334155' : '#cbd5e1'}
                        />
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => !acc.isActive && handleSwitch(acc.accountId)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {acc.isActive ? (
                      <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
                    ) : (
                      <Ionicons name="radio-button-off" size={18} color="#64748b" />
                    )}
                  </TouchableOpacity>

                  {accounts.length > 1 && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRemove(acc.accountId)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {/* Add Another Account Section */}
            <View style={styles.card}>
              <Text style={styles.loginTitle}>Connect Another Epic Account</Text>
              <Text style={styles.loginSub}>
                Add alt or secondary accounts to track combined V-Bucks and perform bulk actions.
              </Text>

              <TouchableOpacity style={styles.linkBtn} onPress={openAuthUrl}>
                <Ionicons name="open-outline" size={14} color="#38bdf8" />
                <Text style={styles.linkBtnText}>1. Open Epic Games Login in Browser</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="2. Paste full URL or 32-character code..."
                placeholderTextColor="#64748b"
                value={authInput}
                onChangeText={setAuthInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity
                style={[styles.loginBtn, loading ? styles.connectBtnDisabled : null]}
                onPress={handleConnect}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.loginBtnText}>+ Connect Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Over-The-Air App Update Card (Always Visible) */}
        <View style={styles.otaCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.otaTitle}>App Version 1.0.2 (GitHub OTA)</Text>
            <Text style={styles.otaSub}>
              {Updates.isEnabled
                ? 'OTA Enabled · Pulls JS updates without reinstalling APK'
                : 'Development mode · Install Release APK for OTA'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.otaBtn}
            onPress={handleCheckOtaUpdate}
            disabled={checkingOta}
          >
            {checkingOta ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="cloud-download-outline" size={14} color="#ffffff" />
                <Text style={styles.otaBtnText}>Check Update</Text>
              </>
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
    paddingBottom: 36
  },
  onboardHero: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 16
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#162238',
    borderWidth: 1,
    borderColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  onboardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 6
  },
  onboardSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12
  },
  stepCard: {
    backgroundColor: '#161b26',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#232b3d',
    marginBottom: 14
  },
  stepBadge: {
    backgroundColor: '#0369a1',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 8
  },
  stepBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  stepTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4
  },
  stepDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12
  },
  primaryAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8
  },
  primaryAuthBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  fallbackLinkText: {
    color: '#38bdf8',
    fontSize: 11,
    textAlign: 'center',
    textDecorationLine: 'underline',
    paddingVertical: 4
  },
  input: {
    backgroundColor: '#0f1420',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#26344d',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 12
  },
  connectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8
  },
  connectBtnDisabled: {
    opacity: 0.6
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0f1f1d',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#134e4a',
    marginTop: 4,
    marginBottom: 16
  },
  infoBannerTitle: {
    color: '#86efac',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3
  },
  infoBannerText: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16
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
    borderColor: '#1f2a3e',
    marginBottom: 12
  },
  activeVBucksLabel: {
    color: '#94a3b8',
    fontSize: 11
  },
  refreshBalanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#16233a',
    borderRadius: 6
  },
  refreshBalanceText: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '700'
  },
  activeVBucksValue: {
    color: '#fbbf24',
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 4
  },
  activeVBucksSubRow: {
    flexDirection: 'row',
    gap: 14
  },
  activeVBucksSubItem: {
    color: '#64748b',
    fontSize: 11
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e2638'
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600'
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionHeader: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  reorderHint: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600'
  },
  orderIndex: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700'
  },
  reorderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101520',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1f2a3e',
    paddingHorizontal: 3,
    paddingVertical: 2,
    gap: 2
  },
  reorderBtn: {
    padding: 3
  },
  reorderBtnDisabled: {
    opacity: 0.45
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
  },
  otaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111723',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f293d',
    gap: 10
  },
  otaTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700'
  },
  otaSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  otaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 5
  },
  otaBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700'
  }
})
