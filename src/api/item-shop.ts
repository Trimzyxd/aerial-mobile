import { ShopItem, GiftBoxTemplate, GrantedItem } from '../types'
import { forceRefreshAccountToken } from './epic-auth'

export const GIFT_BOX_TEMPLATES: GiftBoxTemplate[] = [
  { id: 'GiftBox:gb_default', name: 'Standard', previewColor: '#3a3f58' }
]

export async function fetchItemShop(): Promise<{ items: ShopItem[]; categories: string[] }> {
  try {
    const res = await fetch('https://fortnite-api.com/v2/shop')
    if (!res.ok) {
      console.warn('Shop endpoint returned error status')
      return { items: [], categories: ['All'] }
    }

    const json = await res.json()
    const entries = json?.data?.entries || []
    if (!Array.isArray(entries) || entries.length === 0) {
      return { items: [], categories: ['All'] }
    }

    const items: ShopItem[] = []
    const categoriesSet = new Set<string>()

    for (const entry of entries) {
      // Find primary item across all possible cosmetic arrays
      const brItem = entry.brItems?.[0]
      const track = entry.tracks?.[0]
      const car = entry.cars?.[0]
      const instrument = entry.instruments?.[0]
      const primaryItem = brItem || track || car || instrument || {}

      // High-resolution image extraction hierarchy
      const displayAssetImg = entry.newDisplayAsset?.renderImages?.[0]?.image
      const bundleImg = entry.bundle?.image
      const itemIcon =
        brItem?.images?.icon ||
        brItem?.images?.smallIcon ||
        track?.albumArt ||
        car?.images?.large ||
        instrument?.images?.large

      const resolvedImage = displayAssetImg || bundleImg || itemIcon || brItem?.images?.featured

      const name =
        entry.bundle?.name ||
        brItem?.name ||
        track?.title ||
        car?.name ||
        instrument?.name ||
        entry.devName?.replace(/^\[VIRTUAL\]\d+\s*x\s*/i, '')?.replace(/\s*for\s*-?\d+\s*MtxCurrency/i, '')?.trim() ||
        'Fortnite Item'

      // Identify Actual Bundles:
      // An item is ONLY an actual bundle if:
      // 1. Epic API returns an entry.bundle object, OR
      // 2. The item name or devName explicitly contains "bundle", OR
      // 3. The cosmetic type is explicitly "bundle".
      // A regular skin with a backbling (brItems.length === 2) is NOT a bundle!
      const isBundle = Boolean(
        Boolean(entry.bundle) ||
        Boolean(entry.bundle?.name) ||
        (primaryItem.type?.value === 'bundle') ||
        (entry.devName && entry.devName.toLowerCase().includes('bundle')) ||
        (name.toLowerCase().includes('bundle'))
      )

      // Category grouping
      const cat = entry.layout?.name || entry.layout?.category || entry.section?.name || 'Featured'
      categoriesSet.add(cat)
      if (isBundle) {
        categoriesSet.add('Bundles')
      }

      const rarity =
        brItem?.rarity?.displayValue ||
        brItem?.series?.displayValue ||
        'Rare'

      // Extract all included cosmetics (outfits, backblings, pickaxes, etc.)
      const grantedItems: GrantedItem[] = []

      if (Array.isArray(entry.brItems)) {
        for (const br of entry.brItems) {
          if (!br) continue
          grantedItems.push({
            id: br.id || `grant-${Math.random()}`,
            name: br.name || 'Cosmetic Item',
            description: br.description || '',
            type: br.type?.displayValue || br.type?.value || 'Cosmetic',
            rarity: br.rarity?.displayValue || br.rarity?.value || 'Rare',
            image: br.images?.icon || br.images?.smallIcon || br.images?.featured
          })
        }
      }

      if (Array.isArray(entry.tracks)) {
        for (const t of entry.tracks) {
          if (!t) continue
          grantedItems.push({
            id: t.id || `track-${Math.random()}`,
            name: t.title ? `${t.title} - ${t.artist || ''}`.trim() : 'Jam Track',
            description: t.album || '',
            type: 'Jam Track',
            rarity: 'Rare',
            image: t.albumArt
          })
        }
      }

      if (Array.isArray(entry.cars)) {
        for (const c of entry.cars) {
          if (!c) continue
          grantedItems.push({
            id: c.id || `car-${Math.random()}`,
            name: c.name || 'Vehicle',
            description: c.description || '',
            type: c.type?.displayValue || 'Vehicle',
            rarity: c.rarity?.displayValue || 'Rare',
            image: c.images?.large || c.images?.small || c.images?.icon
          })
        }
      }

      if (Array.isArray(entry.instruments)) {
        for (const inst of entry.instruments) {
          if (!inst) continue
          grantedItems.push({
            id: inst.id || `inst-${Math.random()}`,
            name: inst.name || 'Instrument',
            description: inst.description || '',
            type: inst.type?.displayValue || 'Instrument',
            rarity: inst.rarity?.displayValue || 'Rare',
            image: inst.images?.large || inst.images?.small || inst.images?.icon
          })
        }
      }

      if (grantedItems.length === 0) {
        grantedItems.push({
          id: entry.offerId || primaryItem.id || `grant-${Math.random()}`,
          name,
          description: primaryItem.description || '',
          type: primaryItem.type?.displayValue || primaryItem.type?.value || (isBundle ? 'Bundle' : 'Cosmetic'),
          rarity,
          image: resolvedImage
        })
      }

      items.push({
        id: entry.offerId || primaryItem.id || `offer-${Math.random()}`,
        name,
        description: entry.bundle?.info || primaryItem.description || '',
        price: Number(entry.finalPrice ?? entry.regularPrice ?? 0),
        regularPrice: Number(entry.regularPrice ?? entry.finalPrice ?? 0),
        rarity,
        category: cat,
        isBundle,
        banner: entry.banner?.value,
        images: {
          icon: resolvedImage,
          featured: entry.newDisplayAsset?.renderImages?.[1]?.image || brItem?.images?.featured
        },
        grantedItems,
        giftable: entry.giftable ?? true,
        expires: json?.data?.date || new Date().toISOString()
      })
    }

    const otherCats = Array.from(categoriesSet).filter((c) => c !== 'All' && c !== 'Bundles')
    const sortedCategories = ['All', 'Bundles', ...otherCats]

    return { items, categories: sortedCategories }
  } catch (err) {
    console.warn('Error fetching shop', err)
    return { items: [], categories: ['All'] }
  }
}

export async function purchaseItem({
  offerId,
  price,
  accessToken,
  accountId
}: {
  offerId: string
  price: number
  accessToken?: string
  accountId?: string
}): Promise<{ success: boolean; message: string }> {
  if (!accessToken || !accountId) {
    return { success: false, message: 'Please sign in to an Epic Games account to purchase items.' }
  }

  try {
    const url = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/PurchaseCatalogEntry?profileId=common_core`
    const doPost = (token: string) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
        },
        body: JSON.stringify({
          offerId,
          purchaseQuantity: 1,
          currency: 'MtxCurrency',
          currencySubType: '',
          expectedTotalPrice: price,
          gameContext: 'FrontEnd.Store'
        })
      })

    let res = await doPost(accessToken)
    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed) {
        res = await doPost(refreshed.accessToken)
      }
    }

    if (res.ok) {
      return { success: true, message: 'Item purchased successfully!' }
    }

    const responseData = await res.json().catch(() => ({}))
    const numericErrorCode = Number(responseData?.numericErrorCode)
    const rawError = responseData?.errorMessage || responseData?.errorCode || 'Item purchase failed'
    const rawCombined = `${rawError} ${responseData?.errorCode || ''}`.toLowerCase()

    if (
      numericErrorCode === 28004 ||
      rawCombined.includes('purchase_not_allowed') ||
      rawCombined.includes('already_owned') ||
      rawCombined.includes('already own') ||
      rawCombined.includes('item_already_owned')
    ) {
      return { success: false, message: 'Your account already owns this item.' }
    } else if (
      numericErrorCode === 28001 ||
      rawCombined.includes('insufficient_funds') ||
      rawCombined.includes('not_enough_funds') ||
      rawCombined.includes('not_enough_mtx') ||
      rawCombined.includes('insufficient_balance')
    ) {
      return { success: false, message: 'Insufficient V-Bucks balance to purchase this item.' }
    }

    return { success: false, message: rawError }
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error during purchase' }
  }
}

export interface SendGiftParams {
  offerId: string
  receiverId: string
  receiverDisplayName?: string
  itemName?: string
  price: number
  accessToken?: string
  accountId?: string
}

export async function sendGift({
  offerId,
  receiverId,
  receiverDisplayName,
  itemName = 'this item',
  price,
  accessToken,
  accountId
}: SendGiftParams): Promise<{ success: boolean; message: string; code?: string }> {
  const recipientName = receiverDisplayName || 'Friend'

  // 1. Authentication check
  if (!accessToken || !accountId) {
    return { success: false, message: 'Please sign in to an Epic Games account to send gifts.' }
  }

  // 2. Prevent self-gifting
  if (accountId === receiverId) {
    return {
      success: false,
      message: `Cannot send a gift to yourself (${recipientName}). Use the "Buy" button to purchase cosmetics directly for this account.`,
      code: 'SELF_GIFT'
    }
  }

  try {
    const url = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/GiftCatalogEntry?profileId=common_core`

    // Matches desktop Aerial Launcher exact Fortnite MCP request payload and headers
    const doGift = (token: string) =>
      fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
        },
        body: JSON.stringify({
          offerId,
          receiverAccountIds: [receiverId],
          giftWrapTemplateId: '',
          personalMessage: '',
          purchasePrice: price,
          currency: 'MtxCurrency',
          currencySubType: '',
          expectedTotalPrice: price,
          gameContext: 'FrontEnd.Store'
        })
      })

    let res = await doGift(accessToken)
    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed) {
        res = await doGift(refreshed.accessToken)
      }
    }

    if (res.ok) {
      return { success: true, message: `Gift delivered successfully to ${recipientName}!` }
    }

    // Parse Epic Games error response
    const responseData = await res.json().catch(() => ({}))
    const numericErrorCode = Number(responseData?.numericErrorCode)
    const rawError =
      responseData?.errorMessage ||
      responseData?.errorCode ||
      responseData?.message ||
      `HTTP Error ${res.status}`

    const errorCode = String(responseData?.errorCode || '').toLowerCase()
    const errorMessage = String(responseData?.errorMessage || '').toLowerCase()
    const rawCombined = `${rawError} ${errorCode} ${errorMessage}`.toLowerCase()

    let friendlyMessage = String(rawError)

    if (
      numericErrorCode === 28004 ||
      rawCombined.includes('purchase_not_allowed') ||
      rawCombined.includes('already_owned') ||
      rawCombined.includes('already own') ||
      rawCombined.includes('owns') ||
      rawCombined.includes('item_already_owned') ||
      rawCombined.includes('origination_item_already_owned')
    ) {
      friendlyMessage = `${recipientName} already owns "${itemName}". Epic Games does not allow duplicate gifting.`
    } else if (
      numericErrorCode === 28001 ||
      rawCombined.includes('insufficient_funds') ||
      rawCombined.includes('not_enough_funds') ||
      rawCombined.includes('not_enough_mtx') ||
      rawCombined.includes('insufficient_balance')
    ) {
      friendlyMessage = `Insufficient V-Bucks balance to gift "${itemName}". You need ${price} V-Bucks.`
    } else if (
      numericErrorCode === 28015 ||
      rawCombined.includes('daily_limit') ||
      rawCombined.includes('daily_gift_limit') ||
      rawCombined.includes('max_gifts')
    ) {
      friendlyMessage = `Daily gifting limit reached (5/5 gifts sent today). You can send more gifts after tomorrow's daily shop reset.`
    } else if (
      numericErrorCode === 28014 ||
      rawCombined.includes('not_eligible') ||
      rawCombined.includes('recipient_not_eligible') ||
      rawCombined.includes('friendship')
    ) {
      friendlyMessage = `${recipientName} is not eligible to receive gifts yet (Epic Games requires accounts to be friends for at least 48 hours).`
    } else if (
      rawCombined.includes('two_factor') ||
      rawCombined.includes('2fa') ||
      rawCombined.includes('mfa')
    ) {
      friendlyMessage = `Two-Factor Authentication (2FA) must be enabled on your Epic Games account to send gifts.`
    } else if (rawCombined.includes('allowed_to_send_gifts') || rawCombined.includes('gifting_disabled')) {
      friendlyMessage = `Gifting is currently disabled for this Epic account or region.`
    } else if (res.status === 401 || res.status === 403) {
      friendlyMessage = `Epic Games session expired (401/403). Please re-login to your account.`
    }

    return {
      success: false,
      message: friendlyMessage,
      code: responseData?.errorCode || String(res.status)
    }
  } catch (err: any) {
    return {
      success: false,
      message: err.message ? `Network connection error: ${err.message}` : 'Failed to reach Epic Games gifting servers.',
      code: 'NETWORK_ERROR'
    }
  }
}
