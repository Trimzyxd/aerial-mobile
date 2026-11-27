import { Friend, FriendRequest, SavedAccount } from '../types'
import { forceRefreshAccountToken } from './epic-auth'

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

const EPIC_UA = 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'

function extractEpicDisplayName(user: any): string | undefined {
  if (typeof user?.displayName === 'string' && user.displayName.trim().length > 0) {
    return user.displayName.trim()
  }
  const externalAuths = user?.externalAuths
  if (externalAuths && typeof externalAuths === 'object') {
    for (const auth of Object.values(externalAuths) as any[]) {
      if (typeof auth?.externalDisplayName === 'string' && auth.externalDisplayName.trim().length > 0) {
        return auth.externalDisplayName.trim()
      }
    }
  }
  return undefined
}

async function resolveAccountDisplayNames(
  accountIds: string[],
  accessToken: string,
  ownerAccountId?: string
): Promise<Map<string, string>> {
  const namesMap = new Map<string, string>()
  const uniqueIds = Array.from(new Set(accountIds.filter((id) => typeof id === 'string' && id.trim().length > 0)))
  if (uniqueIds.length === 0 || !accessToken) {
    return namesMap
  }

  let activeToken = accessToken
  const chunkSize = 100

  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const chunk = uniqueIds.slice(i, i + chunkSize)
    const query = chunk.map((id) => `accountId=${encodeURIComponent(id)}`).join('&')
    const url = `https://account-public-service-prod.ol.epicgames.com/account/api/public/account?${query}`

    const doLookup = (token: string) =>
      fetch(url, {
        headers: {
          Authorization: `bearer ${token}`,
          'User-Agent': EPIC_UA
        }
      })

    try {
      let res = await doLookup(activeToken)
      if ((res.status === 401 || res.status === 403) && ownerAccountId) {
        const refreshed = await forceRefreshAccountToken(ownerAccountId)
        if (refreshed?.accessToken) {
          activeToken = refreshed.accessToken
          res = await doLookup(activeToken)
        }
      }

      if (!res.ok) continue

      const users = await res.json()
      if (Array.isArray(users)) {
        for (const user of users) {
          const resolved = extractEpicDisplayName(user)
          if (user?.id && resolved) {
            namesMap.set(user.id, resolved)
          }
        }
      }
    } catch (err) {
      console.warn('Error resolving batch Epic display names', err)
    }
  }

  return namesMap
}

export async function fetchFriendsSummary(accessToken?: string, accountId?: string): Promise<{ friends: Friend[]; requests: FriendRequest[] }> {
  if (!accessToken || !accountId) {
    return { friends: [], requests: [] }
  }

  try {
    const url = `https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/summary`
    const doFetch = (token: string) =>
      fetch(url, {
        headers: {
          'Authorization': `bearer ${token}`,
          'User-Agent': EPIC_UA
        }
      })

    let activeToken = accessToken
    let res = await doFetch(activeToken)
    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed?.accessToken) {
        activeToken = refreshed.accessToken
        res = await doFetch(activeToken)
      }
    }

    if (!res.ok) {
      return { friends: [], requests: [] }
    }

    const data = await res.json()
    const rawFriends = Array.isArray(data.friends) ? data.friends : []
    const rawIncoming = Array.isArray(data.incoming) ? data.incoming : []
    const rawOutgoing = Array.isArray(data.outgoing) ? data.outgoing : []

    const allIds: string[] = [
      ...rawFriends.map((f: any) => f.accountId),
      ...rawIncoming.map((r: any) => r.accountId),
      ...rawOutgoing.map((r: any) => r.accountId)
    ]

    const namesMap = await resolveAccountDisplayNames(allIds, activeToken, accountId)

    const now = Date.now()
    const friends: Friend[] = rawFriends
      .map((f: any) => {
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
          displayName: namesMap.get(f.accountId) || f.displayName || f.alias || f.accountId,
          status: 'ONLINE' as const,
          created: f.created,
          isEligible48h,
          hoursRemaining
        }
      })
      .sort((a: Friend, b: Friend) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }))

    const requests: FriendRequest[] = [
      ...rawIncoming.map((r: any) => ({
        accountId: r.accountId,
        displayName: namesMap.get(r.accountId) || r.displayName || r.alias || r.accountId,
        direction: 'INCOMING' as const,
        created: r.created || 'recently'
      })),
      ...rawOutgoing.map((r: any) => ({
        accountId: r.accountId,
        displayName: namesMap.get(r.accountId) || r.displayName || r.alias || r.accountId,
        direction: 'OUTGOING' as const,
        created: r.created || 'recently'
      }))
    ]

    return { friends, requests }
  } catch (err) {
    console.warn('Error fetching friends summary', err)
    return { friends: [], requests: [] }
  }
}

export async function lookupUser(
  displayNameOrId: string,
  accessToken?: string
): Promise<{ id: string; displayName: string } | null> {
  const query = displayNameOrId.trim()
  if (!query) return null

  // Fast check: 32-character hexadecimal accountId
  if (/^[0-9a-f]{32}$/i.test(query)) {
    if (accessToken) {
      try {
        const res = await fetch(`https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${query}`, {
          headers: {
            Authorization: `bearer ${accessToken}`,
            'User-Agent': EPIC_UA
          }
        })
        if (res.ok) {
          const data = await res.json()
          const resolved = extractEpicDisplayName(data)
          if (data?.id) {
            return { id: data.id, displayName: resolved || query }
          }
        }
      } catch {
        // Fallback to raw accountId below
      }
    }
    return { id: query, displayName: query }
  }

  if (!accessToken) {
    return null
  }

  try {
    const url = `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/displayName/${encodeURIComponent(query)}`
    const res = await fetch(url, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        'User-Agent': EPIC_UA
      }
    })

    if (res.ok) {
      const data = await res.json()
      if (data && data.id) {
        return { id: data.id, displayName: extractEpicDisplayName(data) || query }
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
    return { success: false, message: 'Not authenticated' }
  }

  const doPost = (token: string) =>
    fetch(`https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${targetId}`, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      }
    })

  try {
    let res = await doPost(accessToken)
    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed) {
        res = await doPost(refreshed.accessToken)
      }
    }

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
  if (!accessToken || !accountId) return false
  const doPost = (token: string) =>
    fetch(`https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/incoming/${targetId}`, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${token}`,
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      }
    })

  try {
    let res = await doPost(accessToken)
    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed) {
        res = await doPost(refreshed.accessToken)
      }
    }
    return res.ok
  } catch {
    return false
  }
}

export async function rejectFriendRequest(targetId: string, accessToken?: string, accountId?: string): Promise<boolean> {
  if (!accessToken || !accountId) return false
  const doDel = (token: string) =>
    fetch(`https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/incoming/${targetId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `bearer ${token}`,
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      }
    })

  try {
    let res = await doDel(accessToken)
    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed) {
        res = await doDel(refreshed.accessToken)
      }
    }
    return res.ok
  } catch {
    return false
  }
}

export async function removeFriend(targetId: string, accessToken?: string, accountId?: string): Promise<boolean> {
  if (!accessToken || !accountId) return false
  const doDel = (token: string) =>
    fetch(`https://friends-public-service-prod.ol.epicgames.com/friends/api/v1/${accountId}/friends/${targetId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `bearer ${token}`,
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      }
    })

  try {
    let res = await doDel(accessToken)
    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed) {
        res = await doDel(refreshed.accessToken)
      }
    }
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
