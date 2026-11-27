import React, { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'

import { AlertsScreen } from './src/screens/AlertsScreen'
import { QuestsScreen } from './src/screens/QuestsScreen'
import { FriendsScreen } from './src/screens/FriendsScreen'
import { ShopScreen } from './src/screens/ShopScreen'
import { AccountScreen } from './src/screens/AccountScreen'
import { VBucksVaultModal } from './src/components/VBucksVaultModal'
import {
  loadSavedSession,
  loadAllAccounts,
  switchActiveAccount,
  removeAccount,
  reorderAccounts,
  refreshAllAccountsVbucks
} from './src/api/epic-auth'
import { getSecureItem, saveSecureItem } from './src/utils/storage'
import { EpicAccountSession, SavedAccount } from './src/types'

const Tab = createBottomTabNavigator()
const HEADER_TOTAL_PREF_KEY = 'aerial_show_grand_total_header'

export default function App() {
  const [session, setSession] = useState<EpicAccountSession | null>(null)
  const [accounts, setAccounts] = useState<SavedAccount[]>([])
  const [showGrandTotal, setShowGrandTotal] = useState<boolean>(false)
  const [vaultModalVisible, setVaultModalVisible] = useState<boolean>(false)
  const [refreshingAllBalances, setRefreshingAllBalances] = useState<boolean>(false)

  const refreshData = async () => {
    const s = await loadSavedSession()
    setSession(s)
    const accs = await loadAllAccounts()
    setAccounts(accs)
    const pref = await getSecureItem(HEADER_TOTAL_PREF_KEY)
    setShowGrandTotal(pref === 'true')
  }

  useEffect(() => {
    refreshData()
  }, [])

  const handleToggleGrandTotal = async (val: boolean) => {
    setShowGrandTotal(val)
    await saveSecureItem(HEADER_TOTAL_PREF_KEY, val ? 'true' : 'false')
  }

  const handleSwitchAccount = async (accountId: string) => {
    const switched = await switchActiveAccount(accountId)
    if (switched) {
      setSession({
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
      setAccounts(updated)
    }
  }

  const handleReorderAccounts = async (fromIndex: number, toIndex: number) => {
    const updated = await reorderAccounts(fromIndex, toIndex, accounts)
    setAccounts(updated)
  }

  const handleSessionTokenRefreshed = (accountId: string, accessToken: string) => {
    setSession((prev) => (prev && prev.accountId === accountId ? { ...prev, accessToken } : prev))
    setAccounts((prev) => prev.map((a) => (a.accountId === accountId ? { ...a, accessToken } : a)))
  }

  const handleRefreshAllBalances = async () => {
    if (refreshingAllBalances || accounts.length === 0) return
    setRefreshingAllBalances(true)
    try {
      const updated = await refreshAllAccountsVbucks(accounts)
      setAccounts(updated)
      const active = updated.find((a) => a.accountId === session?.accountId) || updated.find((a) => a.isActive)
      if (active) {
        setSession({
          accountId: active.accountId,
          displayName: active.displayName,
          accessToken: active.accessToken,
          expiresAt: active.expiresAt,
          deviceId: active.deviceId,
          secret: active.secret,
          vbucksBalance: active.vbucks?.total || 0,
          vbucksDetail: active.vbucks
        })
      }
    } finally {
      setRefreshingAllBalances(false)
    }
  }

  const handleRemoveAccount = async (accountId: string) => {
    const updated = await removeAccount(accountId)
    setAccounts(updated)
    const active = updated.find((a) => a.isActive) || updated[0] || null
    if (active) {
      setSession({
        accountId: active.accountId,
        displayName: active.displayName,
        accessToken: active.accessToken,
        expiresAt: active.expiresAt,
        vbucksBalance: active.vbucks?.total || 0,
        vbucksDetail: active.vbucks
      })
    } else {
      setSession(null)
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0d1017' }}>
        <StatusBar style="light" />
        <NavigationContainer theme={DarkTheme}>
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: false,
              tabBarStyle: {
                backgroundColor: '#0f131c',
                borderTopColor: '#1d2536',
                height: 60,
                paddingBottom: 8,
                paddingTop: 8
              },
              tabBarActiveTintColor: '#38bdf8',
              tabBarInactiveTintColor: '#64748b',
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600'
              },
              tabBarIcon: ({ focused, color, size }) => {
                let iconName: keyof typeof Ionicons.glyphMap = 'help'

                if (route.name === 'Alerts') {
                  iconName = focused ? 'sparkles' : 'sparkles-outline'
                } else if (route.name === 'Quests') {
                  iconName = focused ? 'checkbox' : 'checkbox-outline'
                } else if (route.name === 'Shop') {
                  iconName = focused ? 'cart' : 'cart-outline'
                } else if (route.name === 'Friends') {
                  iconName = focused ? 'people' : 'people-outline'
                } else if (route.name === 'Account') {
                  iconName = focused ? 'person' : 'person-outline'
                }

                return <Ionicons name={iconName} size={size} color={color} />
              }
            })}
          >
            <Tab.Screen name="Alerts">
              {() => (
                <AlertsScreen
                  session={session}
                  accounts={accounts}
                  showGrandTotal={showGrandTotal}
                  onOpenVault={() => setVaultModalVisible(true)}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Quests">
              {() => (
                <QuestsScreen
                  session={session}
                  accounts={accounts}
                  showGrandTotal={showGrandTotal}
                  onOpenVault={() => setVaultModalVisible(true)}
                  onSessionTokenRefreshed={handleSessionTokenRefreshed}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Friends">
              {() => (
                <FriendsScreen
                  session={session}
                  accounts={accounts}
                  showGrandTotal={showGrandTotal}
                  onOpenVault={() => setVaultModalVisible(true)}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Shop">
              {() => (
                <ShopScreen
                  session={session}
                  accounts={accounts}
                  showGrandTotal={showGrandTotal}
                  onOpenVault={() => setVaultModalVisible(true)}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Account">
              {() => (
                <AccountScreen
                  session={session}
                  onSessionChange={setSession}
                  accounts={accounts}
                  onAccountsChange={setAccounts}
                  showGrandTotal={showGrandTotal}
                  onToggleGrandTotal={handleToggleGrandTotal}
                  onOpenVault={() => setVaultModalVisible(true)}
                />
              )}
            </Tab.Screen>
          </Tab.Navigator>
        </NavigationContainer>

        {/* Global V-Bucks Vault & Multi-Account Modal */}
        <VBucksVaultModal
          visible={vaultModalVisible}
          accounts={accounts}
          onClose={() => setVaultModalVisible(false)}
          onSwitchAccount={handleSwitchAccount}
          onRemoveAccount={handleRemoveAccount}
          onReorderAccount={handleReorderAccounts}
          onAddAccountPress={() => {
            setVaultModalVisible(false)
          }}
          onRefreshAll={handleRefreshAllBalances}
          refreshingAll={refreshingAllBalances}
          showGrandTotalInHeader={showGrandTotal}
          onToggleHeaderTotal={handleToggleGrandTotal}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
