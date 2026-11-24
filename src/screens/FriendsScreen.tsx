import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Header } from '../components/Header'
import { FriendItem } from '../components/FriendItem'
import {
  fetchFriendsSummary,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  bulkAddFriendAcrossAccounts,
  bulkAcceptIncomingRequestsAcrossAccounts,
  acceptRequestAcrossAllAccounts
} from '../api/friends'
import { loadAllAccounts } from '../api/epic-auth'
import { Friend, FriendRequest, EpicAccountSession, SavedAccount } from '../types'

interface FriendsScreenProps {
  session: EpicAccountSession | null
  accounts?: SavedAccount[]
  showGrandTotal?: boolean
  onOpenVault?: () => void
}

export const FriendsScreen: React.FC<FriendsScreenProps> = ({
  session,
  accounts,
  showGrandTotal,
  onOpenVault
}) => {
  const [activeTab, setActiveTab] = useState<'FRIENDS' | 'REQUESTS'>('FRIENDS')
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Accounts state for bulk operations
  const [localAccounts, setLocalAccounts] = useState<SavedAccount[]>(accounts || [])

  // Bulk operation states
  const [bulkAddModalVisible, setBulkAddModalVisible] = useState<boolean>(false)
  const [bulkAddUsername, setBulkAddUsername] = useState<string>('')
  const [isBulkAdding, setIsBulkAdding] = useState<boolean>(false)
  const [isBulkAccepting, setIsBulkAccepting] = useState<boolean>(false)

  useEffect(() => {
    if (accounts && accounts.length > 0) {
      setLocalAccounts(accounts)
    } else {
      loadAllAccounts().then((accs) => setLocalAccounts(accs))
    }
  }, [accounts])

  const loadData = async () => {
    try {
      const res = await fetchFriendsSummary(session?.accessToken, session?.accountId)
      setFriends(res.friends)
      setRequests(res.requests)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [session])

  const handleAccept = async (accountId: string) => {
    await acceptFriendRequest(accountId, session?.accessToken, session?.accountId)
    Alert.alert('Accepted', 'Friend request accepted!')
    loadData()
  }

  const handleAcceptAllAccounts = async (accountId: string) => {
    const req = requests.find((r) => r.accountId === accountId)
    const targetName = req?.displayName || 'player'

    Alert.alert(
      'Accept on All Accounts',
      `Accept incoming friend request from "${targetName}" across all ${localAccounts.length} saved accounts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept on All',
          style: 'default',
          onPress: async () => {
            const res = await acceptRequestAcrossAllAccounts(accountId, localAccounts)
            Alert.alert('Accepted Across Accounts', `Accepted on ${res.acceptedCount} account(s)!`)
            loadData()
          }
        }
      ]
    )
  }

  const handleReject = async (accountId: string) => {
    await rejectFriendRequest(accountId, session?.accessToken, session?.accountId)
    Alert.alert('Declined', 'Friend request removed.')
    loadData()
  }

  const handleRemove = async (accountId: string) => {
    Alert.alert('Unfriend', 'Remove player from your Epic friends list?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeFriend(accountId, session?.accessToken, session?.accountId)
          loadData()
        }
      }
    ])
  }

  const handleBulkAdd = async () => {
    const target = bulkAddUsername.trim()
    if (!target) {
      Alert.alert('Username Required', 'Please enter an Epic Games display name or Account ID.')
      return
    }

    setIsBulkAdding(true)
    try {
      const res = await bulkAddFriendAcrossAccounts(
        localAccounts,
        target,
        session?.accessToken
      )

      Alert.alert(
        'Bulk Friend Request Sent',
        `Friend request dispatched to "${res.targetDisplayName}" from ${res.successCount} of ${res.totalAccounts} accounts!`
      )
      setBulkAddModalVisible(false)
      setBulkAddUsername('')
      loadData()
    } catch (err: any) {
      Alert.alert('Bulk Add Failed', err.message || 'Unable to send friend requests.')
    } finally {
      setIsBulkAdding(false)
    }
  }

  const handleBulkAcceptAll = () => {
    Alert.alert(
      'Bulk Accept All Requests',
      `Accept all incoming friend requests across all ${localAccounts.length} saved accounts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Accept All Across ${localAccounts.length} Accs`,
          style: 'default',
          onPress: async () => {
            setIsBulkAccepting(true)
            try {
              const res = await bulkAcceptIncomingRequestsAcrossAccounts(localAccounts)
              Alert.alert(
                'Bulk Accept Complete',
                `Accepted ${res.totalAccepted} incoming friend request(s) across ${res.accountsChecked} account(s)!`
              )
              loadData()
            } catch (err: any) {
              Alert.alert('Bulk Accept Failed', err.message || 'Error accepting requests.')
            } finally {
              setIsBulkAccepting(false)
            }
          }
        }
      ]
    )
  }

  const filteredFriends = friends.filter((f) =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const incomingRequests = requests.filter((r) => r.direction === 'INCOMING')

  return (
    <View style={styles.container}>
      <Header
        title="Friends"
        session={session}
        accounts={accounts}
        showGrandTotal={showGrandTotal}
        onOpenVault={onOpenVault}
      />

      {/* Bulk Operations Action Bar */}
      <View style={styles.bulkActionBar}>
        <TouchableOpacity
          style={styles.bulkAddBtn}
          onPress={() => setBulkAddModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={14} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={styles.bulkBtnText}>Bulk Add ({localAccounts.length} Accs)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.bulkAcceptBtn, isBulkAccepting && styles.bulkBtnDisabled]}
          onPress={handleBulkAcceptAll}
          disabled={isBulkAccepting}
          activeOpacity={0.8}
        >
          {isBulkAccepting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="flash" size={14} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.bulkBtnText}>Bulk Accept All</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'FRIENDS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('FRIENDS')}
        >
          <Text style={[styles.tabText, activeTab === 'FRIENDS' && styles.tabTextActive]}>
            Friends ({friends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'REQUESTS' && styles.tabBtnActive]}
          onPress={() => setActiveTab('REQUESTS')}
        >
          <Text style={[styles.tabText, activeTab === 'REQUESTS' && styles.tabTextActive]}>
            Requests ({requests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={activeTab === 'FRIENDS' ? 'Search friends...' : 'Filter requests...'}
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
        </View>
      ) : activeTab === 'FRIENDS' ? (
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.accountId}
          renderItem={({ item }) => <FriendItem friend={item} onRemove={handleRemove} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadData()
              }}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name={session ? "people-outline" : "person-circle-outline"}
                size={36}
                color="#64748b"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.emptyText}>
                {session ? 'No friends found on this account.' : 'No Epic account connected.'}
              </Text>
              {!session && (
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                  Sign in on the Account tab to view your friends list.
                </Text>
              )}
            </View>
          }
        />
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => `${item.direction}-${item.accountId}`}
          renderItem={({ item }) => (
            <FriendItem
              request={item}
              onAccept={handleAccept}
              onAcceptAll={handleAcceptAllAccounts}
              onReject={handleReject}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadData()
              }}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons
                name="mail-outline"
                size={36}
                color="#64748b"
                style={{ marginBottom: 8 }}
              />
              <Text style={styles.emptyText}>
                {session ? 'No incoming or outgoing requests.' : 'Sign in on the Account tab to view friend requests.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Bulk Add Friends Modal */}
      <Modal
        visible={bulkAddModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBulkAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="person-add" size={18} color="#38bdf8" style={{ marginRight: 6 }} />
                <Text style={styles.modalTitle}>Bulk Add Friend</Text>
              </View>
              <TouchableOpacity onPress={() => setBulkAddModalVisible(false)}>
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Sends a friend request simultaneously from all {localAccounts.length} logged-in accounts.
            </Text>

            <View style={styles.inputBox}>
              <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.textInput}
                placeholder="Epic Games username or account ID..."
                placeholderTextColor="#64748b"
                value={bulkAddUsername}
                onChangeText={setBulkAddUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {bulkAddUsername.length > 0 && (
                <TouchableOpacity onPress={() => setBulkAddUsername('')}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.accountsListTitle}>Sending from accounts ({localAccounts.length}):</Text>
            <ScrollView style={styles.accountsScroll} nestedScrollEnabled>
              {localAccounts.map((acc) => (
                <View key={acc.accountId} style={styles.accountItemRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#22c55e" style={{ marginRight: 8 }} />
                  <Text style={styles.accountItemName}>{acc.displayName}</Text>
                  {acc.isActive && (
                    <View style={styles.activeTag}>
                      <Text style={styles.activeTagText}>Active</Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setBulkAddModalVisible(false)}
                disabled={isBulkAdding}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendBulkBtn, isBulkAdding && styles.sendBulkBtnDisabled]}
                onPress={handleBulkAdd}
                disabled={isBulkAdding}
              >
                {isBulkAdding ? (
                  <ActivityIndicator size="small" color="#0d1017" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={14} color="#0d1017" style={{ marginRight: 6 }} />
                    <Text style={styles.sendBulkBtnText}>Send to All ({localAccounts.length})</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1017'
  },
  bulkActionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111724',
    borderBottomWidth: 1,
    borderBottomColor: '#1d273a',
    gap: 10
  },
  bulkAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  bulkAcceptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7c3aed',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  bulkBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  bulkBtnDisabled: {
    opacity: 0.6
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#161d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#202b3f'
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center'
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#38bdf8'
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  },
  tabTextActive: {
    color: '#38bdf8',
    fontWeight: '700'
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161b26',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#232b3d'
  },
  searchIcon: {
    marginRight: 8
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    paddingVertical: 8
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13
  },
  // Bulk Add Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#131824',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#26344d'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1017',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#232d40',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12
  },
  textInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    padding: 0
  },
  accountsListTitle: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  accountsScroll: {
    maxHeight: 130,
    backgroundColor: '#0c1017',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d273a',
    padding: 8,
    marginBottom: 16
  },
  accountItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1d273a'
  },
  accountItemName: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
    flex: 1
  },
  activeTag: {
    backgroundColor: '#0369a1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  activeTagText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#202838'
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  sendBulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38bdf8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  sendBulkBtnDisabled: {
    opacity: 0.5
  },
  sendBulkBtnText: {
    color: '#0d1017',
    fontSize: 12,
    fontWeight: '800'
  }
})
