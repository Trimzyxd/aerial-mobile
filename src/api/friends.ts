import { Friend, FriendRequest, SavedAccount } from '../types'

export interface BulkFriendAddResult {
  targetDisplayName: string
  targetAccountId: string
  totalAccounts: number
  successCount: number
  results: Array<{
    accountId: string
    displayName: string
    success: boolean
    message?: string
  }>
}

export interface BulkFriendAcceptResult {
  totalAccepted: number
  accountsChecked: number
  results: Array<{
    accountId: string
    displayName: string
    acceptedCount: number
    error?: string
  }>
}

const MOCK_FRIENDS: Friend[] = [
  { accountId: 'acc-1', displayName: 'GhostNinja99', status: 'ONLINE' },
  { accountId: 'acc-2', displayName: 'StormShieldCommander', status: 'ONLINE' },
  { accountId: 'acc-3', displayName: 'VBucksGrinder_PH', status: 'AWAY' },
  { accountId: 'acc-4', displayName: 'TwinePeakPro', status: 'OFFLINE', lastSeen: '2 hours ago' }
]

const MOCK_REQUESTS: FriendRequest[] = [
  { accountId: 'req-1', displayName: 'LlamaHunter2026', direction: 'INCOMING', created: '10m ago' },
  { accountId: 'req-2', displayName: 'Ray_Homebase', direction: 'INCOMING', created: '1h ago' },
  { accountId: 'req-3', displayName: 'EpicSniperBot', direction: 'OUTGOING', created: '2d ago' }
]

export async function fetchFriendsSummary(accessToken?: string, accountId?: string): Promise<{ friends: Friend[]; requests: FriendRequest[] }> {
  if (!accessToken || !accountId) {
    return { friends: MOCK_FRIENDS, requests: MOCK_REQUESTS }
  }

  try {
    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/summary`
    const res = await fetch(url, {
      headers: {
        'Authorization': `bearer ${accessToken}`
      }
    })

    if (!res.ok) {
      return { friends: MOCK_FRIENDS, requests: MOCK_REQUESTS }
    }

    const data = await res.json()
    const now = Date.now()
    const friends: Friend[] = (data.friends || []).map((f: any) => {
      let isEligible48h = true
      let hoursRemaining = 0
      if (f.created) {
        const createdMs = new Date(f.created).getTime()
        if (!isNaN(createdMs)) {
          const diffMs = now - createdMs
          isEligible48h = diffMs >= 48 * 3600 * 1000
          hoursRemaining = isEligible48h ? 0 : Math.max(1, Math.ceil((48 * 3600 * 1000 - diffMs) / 3600000))
        }
      }
      return {
        accountId: f.accountId,
        displayName: f.displayName || f.alias || 'Epic Player',
        status: 'ONLINE',
        created: f.created,
        isEligible48h,
        hoursRemaining
      }
    })

    const requests: FriendRequest[] = [
      ...(data.incoming || []).map((r: any) => ({
        accountId: r.accountId,
        displayName: r.displayName || 'Incoming Player',
        direction: 'INCOMING' as const,
        created: r.created || 'recently'
      })),
      ...(data.outgoing || []).map((r: any) => ({
        accountId: r.accountId,
        displayName: r.displayName || 'Outgoing Player',
        direction: 'OUTGOING' as const,
        created: r.created || 'recently'
      }))
    ]

    return { friends, requests }
  } catch (err) {
    console.warn('Error fetching friends summary', err)
    return { friends: MOCK_FRIENDS, requests: MOCK_REQUESTS }
  }
}

export async function lookupUser(
  displayNameOrId: string,
  accessToken?: string
): Promise<{ id: string; displayName: string } | null> {
  const query = displayNameOrId.trim()
  if (!query) return null

  // Fast check: already a 32-character hexadecimal accountId
  if (/^[0-9a-f]{32}$/i.test(query)) {
    return { id: query, displayName: query }
  }

  if (!accessToken) {
    return { id: `acc-${query.toLowerCase().replace(/\s+/g, '_')}`, displayName: query }
  }

  try {
    const url = `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/displayName/${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: {
        Authorization: `bearer ${accessToken}`
      }
    })

    if (res.ok) {
      const data = await res.json()
      if (data && data.id) {
        return { id: data.id, displayName: data.displayName || query }
      }
    }
    return null
  } catch (err) {
    console.warn('Error looking up Epic user', err)
    return null
  }
}

export async function sendFriendRequest(
  targetId: string,
  accessToken?: string,
  accountId?: string
): Promise<{ success: boolean; message?: string }> {
  if (!accessToken || !accountId) {
    return { success: true }
  }

  try {
    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${targetId}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (res.ok) {
      return { success: true }
    }

    const err = await res.json().catch(() => ({}))
    return { success: false, message: err.errorMessage || 'Failed to send request' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error' }
  }
}

export async function acceptFriendRequest(targetId: string, accessToken?: string, accountId?: string): Promise<boolean> {
  if (!accessToken || !accountId) return true
  try {
    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/incoming/${targetId}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `bearer ${accessToken}` }
    })
    return res.ok
  } catch {
    return false
  }
}

export async function rejectFriendRequest(targetId: string, accessToken?: string, accountId?: string): Promise<boolean> {
  if (!accessToken || !accountId) return true
  try {
    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/incoming/${targetId}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `bearer ${accessToken}` }
    })
    return res.ok
  } catch {
    return false
  }
}

export async function removeFriend(targetId: string, accessToken?: string, accountId?: string): Promise<boolean> {
  if (!accessToken || !accountId) return true
  try {
    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${targetId}`
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Authorization': `bearer ${accessToken}` }
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Bulk Add: Sends a friend request to target display name from ALL saved accounts.
 */
export async function bulkAddFriendAcrossAccounts(
  accounts: SavedAccount[],
  displayNameOrId: string,
  activeAccessToken?: string
): Promise<BulkFriendAddResult> {
  if (!accounts || accounts.length === 0) {
    throw new Error('No saved accounts available.')
  }

  const lookup = await lookupUser(displayNameOrId, activeAccessToken || accounts[0]?.accessToken)
  if (!lookup) {
    throw new Error(`Player "${displayNameOrId}" was not found in Epic Games directory.`)
  }

  const results: BulkFriendAddResult['results'] = []
  let successCount = 0

  for (const acc of accounts) {
    const res = await sendFriendRequest(lookup.id, acc.accessToken, acc.accountId)
    if (res.success) {
      successCount++
    }
    results.push({
      accountId: acc.accountId,
      displayName: acc.displayName,
      success: res.success,
      message: res.message
    })
  }

  return {
    targetDisplayName: lookup.displayName,
    targetAccountId: lookup.id,
    totalAccounts: accounts.length,
    successCount,
    results
  }
}

/**
 * Bulk Accept: Accepts all incoming friend requests across ALL saved accounts.
 */
export async function bulkAcceptIncomingRequestsAcrossAccounts(
  accounts: SavedAccount[]
): Promise<BulkFriendAcceptResult> {
  if (!accounts || accounts.length === 0) {
    return { totalAccepted: 0, accountsChecked: 0, results: [] }
  }

  let totalAccepted = 0
  const results: BulkFriendAcceptResult['results'] = []

  for (const acc of accounts) {
    try {
      const summary = await fetchFriendsSummary(acc.accessToken, acc.accountId)
      const incoming = summary.requests.filter((r) => r.direction === 'INCOMING')

      let count = 0
      for (const req of incoming) {
        const ok = await acceptFriendRequest(req.accountId, acc.accessToken, acc.accountId)
        if (ok) {
          count++
          totalAccepted++
        }
      }

      results.push({
        accountId: acc.accountId,
        displayName: acc.displayName,
        acceptedCount: count
      })
    } catch (err: any) {
      results.push({
        accountId: acc.accountId,
        displayName: acc.displayName,
        acceptedCount: 0,
        error: err.message
      })
    }
  }

  return {
    totalAccepted,
    accountsChecked: accounts.length,
    results
  }
}

/**
 * Accept a single incoming request across ALL accounts that received it.
 */
export async function acceptRequestAcrossAllAccounts(
  targetId: string,
  accounts: SavedAccount[]
): Promise<{ acceptedCount: number }> {
  let acceptedCount = 0
  for (const acc of accounts) {
    const ok = await acceptFriendRequest(targetId, acc.accessToken, acc.accountId)
    if (ok) acceptedCount++
  }
  return { acceptedCount }
}
