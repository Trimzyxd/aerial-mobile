// Fortnite Item Shop Screen
import React, { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Image,
  Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Header } from '../components/Header'
import { ShopItemCard, getRarityColor } from '../components/ShopItemCard'
import { fetchItemShop, sendGift, purchaseItem } from '../api/item-shop'
import { fetchFriendsSummary } from '../api/friends'
import { ShopItem, Friend, EpicAccountSession, SavedAccount } from '../types'

interface ShopScreenProps {
  session: EpicAccountSession | null
  accounts?: SavedAccount[]
  showGrandTotal?: boolean
  onOpenVault?: () => void
}

export const ShopScreen: React.FC<ShopScreenProps> = ({
  session,
  accounts,
  showGrandTotal,
  onOpenVault
}) => {
  const [items, setItems] = useState<ShopItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)

  // Item details modal state (clicking card in shop)
  const [selectedDetailItem, setSelectedDetailItem] = useState<ShopItem | null>(null)
  const [isBuying, setIsBuying] = useState<boolean>(false)
  const [detailImageLoading, setDetailImageLoading] = useState<boolean>(true)

  // Gifting modal states
  const [giftingItem, setGiftingItem] = useState<ShopItem | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendSearchQuery, setFriendSearchQuery] = useState<string>('')
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null)
  const [isSending, setIsSending] = useState<boolean>(false)

  const loadShop = async () => {
    try {
      const data = await fetchItemShop()
      setItems(data.items)
      setCategories(data.categories)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadShop()
    fetchFriendsSummary(session?.accessToken, session?.accountId).then((res) => setFriends(res.friends))
  }, [session])

  // Filter items by category and search text
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (selectedCategory === 'Bundles') {
        if (!item.isBundle) return false
      } else if (selectedCategory !== 'All') {
        if (item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false
        }
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchesName = item.name.toLowerCase().includes(q)
        const matchesDesc = item.description.toLowerCase().includes(q)
        const matchesCat = item.category.toLowerCase().includes(q)
        if (!matchesName && !matchesDesc && !matchesCat) {
          return false
        }
      }

      return true
    })
  }, [items, selectedCategory, searchQuery])

  // Filter friends in gift modal by search query
  const filteredFriends = useMemo(() => {
    if (!friendSearchQuery.trim()) return friends
    const q = friendSearchQuery.toLowerCase().trim()
    return friends.filter((f) => f.displayName.toLowerCase().includes(q))
  }, [friends, friendSearchQuery])

  const handleOpenGiftModal = (item: ShopItem) => {
    setGiftingItem(item)
    setSelectedFriend(friends[0] || null)
    setFriendSearchQuery('')
  }

  const handleBuyItem = (item: ShopItem) => {
    Alert.alert(
      'Confirm Purchase',
      `Purchase "${item.name}" for ${item.price} V-Bucks on account ${session?.displayName || 'Active Account'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Buy for ${item.price} V-B`,
          style: 'default',
          onPress: async () => {
            setIsBuying(true)
            try {
              const res = await purchaseItem({
                offerId: item.id,
                price: item.price,
                accessToken: session?.accessToken,
                accountId: session?.accountId
              })
              if (res.success) {
                Alert.alert(
                  'Purchase Successful!',
                  `You have unlocked "${item.name}"! It is now available in your Fortnite Locker.`
                )
                setSelectedDetailItem(null)
              } else {
                Alert.alert('Purchase Failed', res.message)
              }
            } finally {
              setIsBuying(false)
            }
          }
        }
      ]
    )
  }

  const handleSendGift = async () => {
    if (!giftingItem) return
    if (!selectedFriend) {
      Alert.alert('No Friend Selected', 'Please select a recipient friend to send this gift.')
      return
    }

    // Pre-flight check: self-gifting
    if (session?.accountId && selectedFriend.accountId === session.accountId) {
      Alert.alert(
        'Cannot Gift to Self',
        `You cannot gift items to yourself (${selectedFriend.displayName}). Use the "Buy" button instead.`
      )
      return
    }

    // Pre-flight check: Epic 48h friendship rule
    if (selectedFriend.isEligible48h === false) {
      Alert.alert(
        '48-Hour Friendship Rule',
        `${selectedFriend.displayName} cannot receive gifts yet. Epic Games requires both accounts to be friends for at least 48 hours (${selectedFriend.hoursRemaining || 48}h remaining).`
      )
      return
    }

    // Pre-flight check: balance check
    if (session?.vbucksBalance !== undefined && session.vbucksBalance < giftingItem.price) {
      Alert.alert(
        'Insufficient V-Bucks',
        `Account "${session.displayName}" has ${session.vbucksBalance} V-Bucks, but "${giftingItem.name}" costs ${giftingItem.price} V-Bucks.`
      )
      return
    }

    setIsSending(true)
    try {
      const res = await sendGift({
        offerId: giftingItem.id,
        receiverId: selectedFriend.accountId,
        receiverDisplayName: selectedFriend.displayName,
        itemName: giftingItem.name,
        price: giftingItem.price,
        accessToken: session?.accessToken,
        accountId: session?.accountId
      })

      if (res.success) {
        Alert.alert(
          'Gift Delivered! 🎁',
          `Successfully sent ${giftingItem.name} to ${selectedFriend.displayName}!`
        )
        setGiftingItem(null)
      } else {
        Alert.alert('Gifting Failed', res.message)
      }
    } finally {
      setIsSending(false)
    }
  }

  const detailRarityTheme = selectedDetailItem ? getRarityColor(selectedDetailItem.rarity) : null

  return (
    <View style={styles.container}>
      <Header
        title="Item Shop"
        session={session}
        accounts={accounts}
        showGrandTotal={showGrandTotal}
        onOpenVault={onOpenVault}
      />

      {/* Shop Search Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputRow}>
          <Ionicons name="search" size={16} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search item, skin, or bundle..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categoryScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat
            const isBundlesTab = cat === 'Bundles'
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillActive,
                  isBundlesTab && styles.categoryPillBundle
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                {isBundlesTab && (
                  <Ionicons
                    name="cube"
                    size={13}
                    color={isSelected ? '#0d1017' : '#f59e0b'}
                    style={{ marginRight: 5 }}
                  />
                )}
                <Text
                  style={[
                    styles.categoryText,
                    isSelected && styles.categoryTextActive,
                    isBundlesTab && !isSelected && styles.categoryTextBundle
                  ]}
                  numberOfLines={1}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Fetching item shop catalog...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={({ item }) => (
            <ShopItemCard
              item={item}
              onPress={(it) => {
                setSelectedDetailItem(it)
                setDetailImageLoading(true)
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadShop()
              }}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="pricetags-outline" size={40} color="#64748b" />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySub}>
                {searchQuery ? `No cosmetics matched "${searchQuery}"` : 'Check back after daily shop refresh.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Item Details Modal (Fortnite in-game shop style) */}
      <Modal
        visible={!!selectedDetailItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDetailItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContent}>
            {selectedDetailItem && detailRarityTheme && (
              <>
                {/* Modal Header */}
                <View style={styles.detailHeader}>
                  <View style={styles.detailTagRow}>
                    <View style={[styles.detailRarityPill, { backgroundColor: detailRarityTheme.bg }]}>
                      <Text style={[styles.detailRarityText, { color: detailRarityTheme.text }]}>
                        {selectedDetailItem.rarity.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.detailCategoryPill}>
                      <Text style={styles.detailCategoryText}>{selectedDetailItem.category}</Text>
                    </View>
                    {selectedDetailItem.isBundle && (
                      <View style={styles.bundlePill}>
                        <Ionicons name="cube" size={10} color="#ffffff" style={{ marginRight: 3 }} />
                        <Text style={styles.bundlePillText}>BUNDLE</Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedDetailItem(null)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={22} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* Scrollable details */}
                <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
                  {/* Large Render Image */}
                  <View style={[styles.detailImageContainer, { borderColor: detailRarityTheme.border }]}>
                    <Image
                      source={{
                        uri: selectedDetailItem.images.featured || selectedDetailItem.images.icon
                      }}
                      style={styles.detailImage}
                      resizeMode="contain"
                      onLoadStart={() => setDetailImageLoading(true)}
                      onLoadEnd={() => setDetailImageLoading(false)}
                    />
                    {detailImageLoading && (
                      <View style={styles.loaderOverlay}>
                        <ActivityIndicator size="small" color="#38bdf8" />
                      </View>
                    )}
                  </View>

                  {/* Title & Banner */}
                  <View style={styles.detailTitleRow}>
                    <Text style={styles.detailTitle}>{selectedDetailItem.name}</Text>
                    {selectedDetailItem.banner && (
                      <View style={styles.detailBanner}>
                        <Text style={styles.detailBannerText}>{selectedDetailItem.banner}</Text>
                      </View>
                    )}
                  </View>

                  {/* Price Row */}
                  <View style={styles.detailPriceRow}>
                    <Ionicons name="sparkles" size={16} color="#f59e0b" />
                    <Text style={styles.detailPriceText}>{selectedDetailItem.price} V-Bucks</Text>
                    {selectedDetailItem.regularPrice > selectedDetailItem.price && (
                      <>
                        <Text style={styles.detailRegularPrice}>
                          {selectedDetailItem.regularPrice}
                        </Text>
                        <View style={styles.detailSavingsPill}>
                          <Text style={styles.detailSavingsText}>
                            Save {selectedDetailItem.regularPrice - selectedDetailItem.price} V-B
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Description */}
                  {selectedDetailItem.description !== '' && (
                    <Text style={styles.detailDesc}>{selectedDetailItem.description}</Text>
                  )}

                  {/* What's Included Section */}
                  {selectedDetailItem.grantedItems && selectedDetailItem.grantedItems.length > 0 && (
                    <View style={styles.detailIncludedSection}>
                      <View style={styles.sectionHeadingRow}>
                        <Ionicons name="grid-outline" size={13} color="#38bdf8" />
                        <Text style={styles.detailSectionTitle}>
                          {selectedDetailItem.isBundle
                            ? `Bundle Contents (${selectedDetailItem.grantedItems.length} items)`
                            : `What's Included (${selectedDetailItem.grantedItems.length} item${selectedDetailItem.grantedItems.length > 1 ? 's' : ''})`}
                        </Text>
                      </View>

                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.detailGrantsScroll}
                      >
                        {selectedDetailItem.grantedItems.map((grant) => (
                          <View key={grant.id} style={styles.detailGrantCard}>
                            {grant.image ? (
                              <Image
                                source={{ uri: grant.image }}
                                style={styles.detailGrantThumb}
                                resizeMode="contain"
                              />
                            ) : (
                              <View style={styles.detailGrantThumbFallback}>
                                <Ionicons name="cube-outline" size={24} color="#64748b" />
                              </View>
                            )}
                            <Text style={styles.detailGrantName} numberOfLines={1}>
                              {grant.name}
                            </Text>
                            <Text style={styles.detailGrantType} numberOfLines={1}>
                              {grant.type}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </ScrollView>

                {/* Bottom Action Bar: Buy and Gift Buttons */}
                <View style={styles.detailActionBar}>
                  <TouchableOpacity
                    style={[styles.buyBtn, isBuying && styles.buyBtnDisabled]}
                    onPress={() => handleBuyItem(selectedDetailItem)}
                    disabled={isBuying}
                    activeOpacity={0.8}
                  >
                    {isBuying ? (
                      <ActivityIndicator size="small" color="#0d1017" />
                    ) : (
                      <>
                        <Ionicons name="cart" size={16} color="#0d1017" />
                        <Text style={styles.buyBtnText}>
                          Buy ({selectedDetailItem.price} V-B)
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {selectedDetailItem.giftable && (
                    <TouchableOpacity
                      style={styles.detailGiftBtn}
                      onPress={() => {
                        const itemToGift = selectedDetailItem
                        setSelectedDetailItem(null)
                        handleOpenGiftModal(itemToGift)
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="gift-outline" size={16} color="#ffffff" />
                      <Text style={styles.detailGiftBtnText}>Gift to Friend</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modern Gifting Dialog with Full Included Items Breakdown */}
      <Modal
        visible={!!giftingItem}
        transparent
        animationType="fade"
        onRequestClose={() => setGiftingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gift to Friend</Text>
              <TouchableOpacity
                onPress={() => setGiftingItem(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Gift Item Summary Card */}
            {giftingItem && (
              <View style={styles.giftPreviewRow}>
                {giftingItem.images.icon ? (
                  <Image
                    source={{ uri: giftingItem.images.icon }}
                    style={styles.giftThumbnail}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name="cube-outline" size={32} color="#64748b" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.giftItemName}>{giftingItem.name}</Text>
                  <Text style={styles.giftItemPrice}>🪙 {giftingItem.price} V-Bucks</Text>
                </View>
                {giftingItem.isBundle && (
                  <View style={styles.bundlePill}>
                    <Ionicons name="cube" size={10} color="#ffffff" style={{ marginRight: 3 }} />
                    <Text style={styles.bundlePillText}>BUNDLE</Text>
                  </View>
                )}
              </View>
            )}

            {/* Included Items in Bundle/Skin breakdown */}
            {giftingItem && giftingItem.grantedItems && giftingItem.grantedItems.length > 0 && (
              <View style={styles.giftIncludedBox}>
                <Text style={styles.giftIncludedTitle}>
                  {giftingItem.isBundle
                    ? `Bundle Contents (${giftingItem.grantedItems.length} items):`
                    : `Included Items (${giftingItem.grantedItems.length}):`}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.giftIncludedScroll}
                >
                  {giftingItem.grantedItems.map((grant) => (
                    <View key={grant.id} style={styles.giftIncludedCard}>
                      {grant.image ? (
                        <Image
                          source={{ uri: grant.image }}
                          style={styles.giftIncludedThumb}
                          resizeMode="contain"
                        />
                      ) : (
                        <View style={styles.giftIncludedThumbFallback}>
                          <Ionicons name="cube-outline" size={18} color="#64748b" />
                        </View>
                      )}
                      <Text style={styles.giftIncludedName} numberOfLines={1}>
                        {grant.name}
                      </Text>
                      <Text style={styles.giftIncludedType} numberOfLines={1}>
                        {grant.type}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Friend Search Bar */}
            <View style={styles.friendSearchContainer}>
              <Ionicons name="search" size={15} color="#94a3b8" />
              <TextInput
                style={styles.friendSearchInput}
                placeholder="Search friend by name..."
                placeholderTextColor="#64748b"
                value={friendSearchQuery}
                onChangeText={setFriendSearchQuery}
                autoCorrect={false}
              />
              {friendSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setFriendSearchQuery('')}>
                  <Ionicons name="close-circle" size={15} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Vertical Scrollable Friends List */}
            <Text style={styles.modalLabel}>
              Select Recipient ({filteredFriends.length} {filteredFriends.length === 1 ? 'friend' : 'friends'})
            </Text>

            <ScrollView style={styles.verticalFriendsScroll} nestedScrollEnabled>
              {filteredFriends.map((f) => {
                const isSelected = selectedFriend?.accountId === f.accountId
                const isOnline = f.status === 'ONLINE'
                return (
                  <TouchableOpacity
                    key={f.accountId}
                    style={[styles.friendRow, isSelected && styles.friendRowActive]}
                    onPress={() => setSelectedFriend(f)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusDot, isOnline ? styles.statusDotOnline : null]} />
                    <View style={styles.friendRowInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.friendRowName, isSelected && styles.friendRowNameActive]}>
                          {f.displayName}
                        </Text>
                        {f.isEligible48h === false && (
                          <View style={styles.ineligibleBadge}>
                            <Ionicons name="time-outline" size={10} color="#f59e0b" style={{ marginRight: 2 }} />
                            <Text style={styles.ineligibleBadgeText}>
                              {f.hoursRemaining ? `${f.hoursRemaining}h` : '<48h'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.friendRowStatus}>
                        {f.isEligible48h === false
                          ? `Eligible in ${f.hoursRemaining || 48}h (48-hr rule)`
                          : isOnline ? 'Online' : f.status === 'AWAY' ? 'Away' : 'Offline'}
                      </Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkmark-circle' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? '#38bdf8' : '#64748b'}
                    />
                  </TouchableOpacity>
                )
              })}

              {filteredFriends.length === 0 && (
                <View style={styles.emptyFriendsBox}>
                  <Ionicons name="people-outline" size={24} color="#64748b" />
                  <Text style={styles.emptyFriendsText}>
                    {friendSearchQuery ? 'No matching friends found' : 'No friends on your friends list'}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setGiftingItem(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmGiftBtn,
                  (!selectedFriend || isSending) && styles.confirmGiftBtnDisabled
                ]}
                onPress={handleSendGift}
                disabled={!selectedFriend || isSending}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane" size={14} color="#ffffff" />
                    <Text style={styles.confirmGiftBtnText}>
                      Send to {selectedFriend ? selectedFriend.displayName : 'Friend'}
                    </Text>
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
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161c28',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#26344d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 13,
    padding: 0
  },
  categoryScrollWrapper: {
    paddingVertical: 6,
    marginBottom: 6
  },
  categoryScroll: {
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#161d2d',
    borderWidth: 1,
    borderColor: '#243048',
    marginRight: 8,
    minHeight: 38
  },
  categoryPillActive: {
    backgroundColor: '#38bdf8',
    borderColor: '#38bdf8'
  },
  categoryPillBundle: {
    borderColor: '#b45309',
    backgroundColor: '#271705'
  },
  categoryText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center'
  },
  categoryTextActive: {
    color: '#0d1017',
    fontWeight: '800'
  },
  categoryTextBundle: {
    color: '#fbbf24',
    fontWeight: '800'
  },
  listContent: {
    padding: 8,
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
    marginTop: 4,
    textAlign: 'center'
  },
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
    backgroundColor: '#151b27',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#26334a'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  modalTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
  },
  giftPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111622',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222d42',
    marginBottom: 12,
    gap: 10
  },
  giftThumbnail: {
    width: 44,
    height: 44,
    backgroundColor: '#1c2436',
    borderRadius: 6
  },
  giftItemName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700'
  },
  giftItemPrice: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2
  },
  friendSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10141f',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#253046',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
    gap: 8
  },
  friendSearchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12,
    padding: 0
  },
  modalLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  verticalFriendsScroll: {
    maxHeight: 180,
    marginBottom: 14
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111724',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#1d273a',
    marginBottom: 6
  },
  friendRowActive: {
    borderColor: '#0284c7',
    backgroundColor: '#0c2338'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#64748b',
    marginRight: 10
  },
  statusDotOnline: {
    backgroundColor: '#22c55e'
  },
  friendRowInfo: {
    flex: 1
  },
  friendRowName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600'
  },
  friendRowNameActive: {
    color: '#38bdf8',
    fontWeight: '700'
  },
  friendRowStatus: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 1
  },
  emptyFriendsBox: {
    alignItems: 'center',
    padding: 20,
    gap: 6
  },
  emptyFriendsText: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center'
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
  confirmGiftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0284c7'
  },
  confirmGiftBtnDisabled: {
    opacity: 0.5
  },
  confirmGiftBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  ineligibleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b1c05',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#f59e0b'
  },
  ineligibleBadgeText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '700'
  },
  // Item Details Modal Styles
  detailModalContent: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: '#131824',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#26344d'
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  detailTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  detailRarityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  detailRarityText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  detailCategoryPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4
  },
  detailCategoryText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600'
  },
  bundlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b45309',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4
  },
  bundlePillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800'
  },
  detailScroll: {
    marginBottom: 10
  },
  detailImageContainer: {
    width: '100%',
    height: 190,
    backgroundColor: '#0c1017',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
    marginBottom: 12
  },
  detailImage: {
    width: '90%',
    height: '90%'
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 16, 23, 0.6)'
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8
  },
  detailTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    flex: 1
  },
  detailBanner: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  detailBannerText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800'
  },
  detailPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  detailPriceText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '800'
  },
  detailRegularPrice: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'line-through'
  },
  detailSavingsPill: {
    backgroundColor: '#14532d',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  detailSavingsText: {
    color: '#86efac',
    fontSize: 10,
    fontWeight: '700'
  },
  detailDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14
  },
  detailIncludedSection: {
    backgroundColor: '#0e121b',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1d2638',
    marginBottom: 10
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  detailSectionTitle: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  detailGrantsScroll: {
    gap: 8,
    paddingBottom: 2
  },
  detailGrantCard: {
    width: 90,
    backgroundColor: '#141a26',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222d42',
    marginRight: 6
  },
  detailGrantThumb: {
    width: 48,
    height: 48,
    backgroundColor: '#0c1017',
    borderRadius: 6,
    marginBottom: 4
  },
  detailGrantThumbFallback: {
    width: 48,
    height: 48,
    backgroundColor: '#0c1017',
    borderRadius: 6,
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  detailGrantName: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%'
  },
  detailGrantType: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2
  },
  detailActionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  buyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#38bdf8',
    paddingVertical: 12,
    borderRadius: 10
  },
  buyBtnDisabled: {
    opacity: 0.6
  },
  buyBtnText: {
    color: '#0d1017',
    fontSize: 13,
    fontWeight: '800'
  },
  detailGiftBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7c3aed',
    paddingVertical: 12,
    borderRadius: 10
  },
  detailGiftBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  // Gifting modal bundle contents breakdown
  giftIncludedBox: {
    backgroundColor: '#0f1420',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1f293d',
    marginBottom: 10
  },
  giftIncludedTitle: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8
  },
  giftIncludedScroll: {
    gap: 6
  },
  giftIncludedCard: {
    width: 76,
    backgroundColor: '#161c28',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#26344d',
    marginRight: 6
  },
  giftIncludedThumb: {
    width: 38,
    height: 38,
    borderRadius: 4,
    backgroundColor: '#101522',
    marginBottom: 4
  },
  giftIncludedThumbFallback: {
    width: 38,
    height: 38,
    borderRadius: 4,
    backgroundColor: '#101522',
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  giftIncludedName: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%'
  },
  giftIncludedType: {
    color: '#64748b',
    fontSize: 8,
    textAlign: 'center',
    marginTop: 1
  }
})
