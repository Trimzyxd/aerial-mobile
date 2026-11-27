import React, { memo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ShopItem } from '../types'

interface ShopItemCardProps {
  item: ShopItem
  onPress: (item: ShopItem) => void
}

export function getRarityColor(rarity: string): { border: string; text: string; bg: string } {
  const r = (rarity || '').toLowerCase()
  if (r.includes('legendary')) return { border: '#ea580c', text: '#fdba74', bg: '#431407' }
  if (r.includes('epic')) return { border: '#9333ea', text: '#d8b4fe', bg: '#3b0764' }
  if (r.includes('rare')) return { border: '#0284c7', text: '#7dd3fc', bg: '#082f49' }
  if (r.includes('uncommon')) return { border: '#16a34a', text: '#86efac', bg: '#052e16' }
  if (r.includes('icon') || r.includes('gaming') || r.includes('marvel') || r.includes('star')) {
    return { border: '#f59e0b', text: '#fde68a', bg: '#451a03' }
  }
  return { border: '#334155', text: '#94a3b8', bg: '#1e293b' }
}

export const SHOP_CARD_ROW_HEIGHT = 246

export const ShopItemCard: React.FC<ShopItemCardProps> = memo(({ item, onPress }) => {
  const [imageError, setImageError] = useState<boolean>(false)

  const imageUri = item.images.icon || item.images.featured || ''
  const rarityTheme = getRarityColor(item.rarity)

  const extraItems = item.grantedItems?.slice(1) || []
  const extraCount = extraItems.length
  const hasBackBling = extraItems.some((i) => i.type.toLowerCase().includes('back'))

  let includedLabel = ''
  if (item.isBundle && item.grantedItems && item.grantedItems.length > 1) {
    includedLabel = `${item.grantedItems.length} Items Included`
  } else if (hasBackBling) {
    includedLabel = '+ Back Bling'
  } else if (extraCount > 0) {
    includedLabel = `+${extraCount} item${extraCount > 1 ? 's' : ''}`
  }

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor: rarityTheme.border }]}
      onPress={() => onPress(item)}
      activeOpacity={0.82}
    >
      <View style={styles.imageContainer}>
        {imageUri && !imageError ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
            resizeMethod="resize"
            fadeDuration={0}
            onError={() => setImageError(true)}
          />
        ) : (
          <View style={styles.fallbackBox}>
            <Ionicons name="cube-outline" size={40} color="#64748b" />
            <Text style={styles.fallbackText}>{item.rarity}</Text>
          </View>
        )}

        {item.banner && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>{item.banner}</Text>
          </View>
        )}

        {item.isBundle && (
          <View style={styles.bundleBadge}>
            <Ionicons name="cube" size={10} color="#ffffff" style={{ marginRight: 3 }} />
            <Text style={styles.bundleBadgeText}>BUNDLE</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={[styles.rarityPill, { backgroundColor: rarityTheme.bg }]}>
            <Text style={[styles.rarityText, { color: rarityTheme.text }]}>
              {item.rarity.toUpperCase()}
            </Text>
          </View>
          {includedLabel !== '' && (
            <View style={styles.includedTag}>
              <Text style={styles.includedTagText}>{includedLabel}</Text>
            </View>
          )}
        </View>

        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.priceRow}>
          <View style={styles.priceContainer}>
            <Ionicons name="sparkles" size={12} color="#f59e0b" />
            <Text style={styles.price}>{item.price} V-B</Text>
            {item.regularPrice > item.price && (
              <Text style={styles.regularPrice}>{item.regularPrice}</Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={14} color="#64748b" />
        </View>
      </View>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  card: {
    flex: 1,
    height: 234,
    backgroundColor: '#161b26',
    borderRadius: 12,
    margin: 6,
    overflow: 'hidden',
    borderWidth: 1,
    maxWidth: '48%'
  },
  imageContainer: {
    width: '100%',
    height: 145,
    backgroundColor: '#121722',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  image: {
    width: '92%',
    height: '92%'
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 23, 34, 0.6)'
  },
  fallbackBox: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4
  },
  fallbackText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  banner: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800'
  },
  bundleBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b45309',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  bundleBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800'
  },
  content: {
    padding: 10
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 4
  },
  rarityPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  rarityText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  includedTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#38bdf8'
  },
  includedTagText: {
    color: '#38bdf8',
    fontSize: 8,
    fontWeight: '700'
  },
  name: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3
  },
  price: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800'
  },
  regularPrice: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    textDecorationLine: 'line-through',
    marginLeft: 3
  }
})
