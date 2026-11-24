import { EpicAccountSession, SavedAccount, VBucksDetail } from '../types'
import { saveSecureItem, getSecureItem, deleteSecureItem } from '../utils/storage'

// Standard Epic Games OAuth Client Credentials (used across desktop launcher & mobile)
// Android Game Client (primary for authorization codes & device auth)
export const ANDROID_CLIENT_ID = '3f69e56c7649492c8cc29f1af08a8a12'
export const ANDROID_AUTH = 'M2Y2OWU1NmM3NjQ5NDkyYzhjYzI5ZjFhZjA4YThhMTI6YjUxZWU5Y2IxMjIzNGY1MGE2OWVmYTY3ZWY1MzgxMmU='

// iOS Game Client (secondary authorization client)
export const IOS_CLIENT_ID = '3446cd72694c4a4485d81b77adbb2141'
export const IOS_AUTH = 'MzQ0NmNkNzI2OTRjNGE0NDg1ZDgxYjc3YWRiYjIxNDE6OTIwOWQ0YTVlMjVhNDU3ZmI5YjA3NDg5ZDMxM2I0MWE='

// Switch Client (used for exchange codes)
export const SWITCH_CLIENT_ID = '3446270ad57743c681c780b184e49e94'
export const SWITCH_AUTH = 'MzQ0NjI3MGFkNTc3NDNjNjgxYzc4MGIxODRlNDllOTQ6WjNkaFMycHRVSHpvV0h1TVVHQzBNV0h1TVVHQzBNV0h1TVU='

// Direct login redirect URLs (opens in device browser)
export const EPIC_LOGIN_AUTH_URL = `https://www.epicgames.com/id/api/redirect?clientId=${ANDROID_CLIENT_ID}&responseType=code`
export const EPIC_LOGIN_FALLBACK_URL = `https://www.epicgames.com/id/api/redirect?clientId=${SWITCH_CLIENT_ID}&responseType=code`

const SAVED_ACCOUNTS_KEY = 'aerial_saved_accounts'
const ACTIVE_ACCOUNT_KEY = 'epic_session'

/**
 * Extracts a 32-character hex code from any user input:
 * - Bare 32-character code: "1234567890abcdef1234567890abcdef"
 * - Full redirect URL: "https://www.epicgames.com/id/api/redirect?code=1234567890abcdef1234567890abcdef"
 * - JSON response: '{"redirectUrl":"...","authorizationCode":"1234567890abcdef1234567890abcdef"}'
 */
export function extractCodeFromInput(input: string): string | null {
  if (!input) return null
  const trimmed = input.trim()

  // Match 32 continuous hex characters
  const match = trimmed.match(/[a-f0-9]{32}/i)
  if (match) {
    return match[0]
  }

  // Fallback: check query parameter ?code=...
  const urlMatch = trimmed.match(/[?&]code=([a-f0-9]+)/i)
  if (urlMatch) {
    return urlMatch[1]
  }

  return trimmed.length >= 20 ? trimmed : null
}

export async function fetchAccountVbucks(accessToken: string, accountId: string): Promise<VBucksDetail> {
  const emptyVbucks: VBucksDetail = { total: 0, complimentary: 0, purchased: 0 }
  if (!accessToken || !accountId) {
    return emptyVbucks
  }

  try {
    const url = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=common_core`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      },
      body: JSON.stringify({})
    })

    if (!res.ok) {
      console.warn('Failed to query common_core profile for V-Bucks')
      return emptyVbucks
    }

    const data = await res.json()
    const items = data?.profileChanges?.[0]?.profile?.items || {}

    let total = 0
    let complimentary = 0
    let purchased = 0

    for (const item of Object.values<any>(items)) {
      if (item?.templateId?.startsWith('Currency:Mtx')) {
        const qty = item?.quantity || 0
        total += qty
        if (item.templateId.includes('Complimentary')) {
          complimentary += qty
        } else if (item.templateId.includes('Purchased')) {
          purchased += qty
        }
      }
    }

    return { total, complimentary, purchased }
  } catch (err) {
    console.warn('Error fetching V-Bucks balance', err)
    return emptyVbucks
  }
}

/**
 * Creates persistent Device Auth credentials for an account.
 * Allows silent, permanent token refreshes without re-prompting the user.
 */
export async function createDeviceAuth(
  accessToken: string,
  accountId: string
): Promise<{ deviceId: string; secret: string } | null> {
  try {
    const url = `https://account-public-service-prod.ol.epicgames.com/account/api/public/account/${accountId}/deviceAuth`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!res.ok) {
      console.warn('Failed to create device auth credentials')
      return null
    }

    const data = await res.json()
    if (data?.deviceId && data?.secret) {
      return { deviceId: data.deviceId, secret: data.secret }
    }
    return null
  } catch (err) {
    console.warn('Error creating device auth', err)
    return null
  }
}

/**
 * Refreshes an account's access token using its saved Device Auth credentials.
 */
export async function refreshAccountWithDeviceAuth(account: SavedAccount): Promise<SavedAccount | null> {
  if (!account.deviceId || !account.secret || !account.accountId) {
    return null
  }

  try {
    const res = await fetch('https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${ANDROID_AUTH}`
      },
      body: new URLSearchParams({
        grant_type: 'device_auth',
        account_id: account.accountId,
        device_id: account.deviceId,
        secret: account.secret
      }).toString()
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    const newAccessToken = data.access_token
    const newExpiresAt = new Date(Date.now() + (data.expires_in || 28800) * 1000).toISOString()
    const vbucks = await fetchAccountVbucks(newAccessToken, account.accountId)

    const updatedAccount: SavedAccount = {
      ...account,
      accessToken: newAccessToken,
      expiresAt: newExpiresAt,
      vbucks
    }

    return updatedAccount
  } catch (err) {
    console.warn('Failed to refresh account with device auth', err)
    return null
  }
}

export async function loadAllAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await getSecureItem(SAVED_ACCOUNTS_KEY)
    if (!raw) return []
    const accounts: SavedAccount[] = JSON.parse(raw)
    // Filter out any legacy demo accounts
    const realAccounts = accounts.filter(
      (a) => a.accountId && !a.accountId.startsWith('demo-') && a.displayName !== 'Commander Main'
    )
    if (realAccounts.length !== accounts.length) {
      await saveAllAccounts(realAccounts)
    }
    return realAccounts
  } catch {
    return []
  }
}

export async function saveAllAccounts(accounts: SavedAccount[]): Promise<void> {
  await saveSecureItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts))
}

export async function addOrUpdateAccount(
  session: EpicAccountSession,
  vbucks: VBucksDetail
): Promise<SavedAccount[]> {
  const current = await loadAllAccounts()
  const filtered = current.filter(
    (a) => a.accountId !== session.accountId && !a.accountId.startsWith('demo-')
  )

  const newAccount: SavedAccount = {
    accountId: session.accountId,
    displayName: session.displayName,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    deviceId: session.deviceId,
    secret: session.secret,
    vbucks,
    isActive: true
  }

  // Deactivate other accounts
  const updated = filtered.map((a) => ({ ...a, isActive: false }))
  updated.unshift(newAccount)

  await saveAllAccounts(updated)
  await saveSecureItem(
    ACTIVE_ACCOUNT_KEY,
    JSON.stringify({
      ...session,
      vbucksBalance: vbucks.total,
      vbucksDetail: vbucks
    })
  )

  return updated
}

export async function switchActiveAccount(accountId: string): Promise<SavedAccount | null> {
  const accounts = await loadAllAccounts()
  let selected = accounts.find((a) => a.accountId === accountId) || null
  if (!selected) return null

  // Check if token expired or about to expire (within 2 minutes)
  const isExpired = new Date(selected.expiresAt).getTime() < Date.now() + 120000
  if (isExpired && selected.deviceId && selected.secret) {
    const refreshed = await refreshAccountWithDeviceAuth(selected)
    if (refreshed) {
      selected = refreshed
    }
  }

  const updated = accounts.map((acc) => ({
    ...acc,
    ...(acc.accountId === accountId ? selected : {}),
    isActive: acc.accountId === accountId
  }))

  await saveAllAccounts(updated)

  const session: EpicAccountSession = {
    accountId: selected.accountId,
    displayName: selected.displayName,
    accessToken: selected.accessToken,
    expiresAt: selected.expiresAt,
    deviceId: selected.deviceId,
    secret: selected.secret,
    vbucksBalance: selected.vbucks.total,
    vbucksDetail: selected.vbucks
  }

  await saveSecureItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(session))
  return selected
}

export async function removeAccount(accountId: string): Promise<SavedAccount[]> {
  const accounts = await loadAllAccounts()
  const updated = accounts.filter((a) => a.accountId !== accountId)
  await saveAllAccounts(updated)

  const active = updated.find((a) => a.isActive) || updated[0] || null
  if (active) {
    await switchActiveAccount(active.accountId)
  } else {
    await deleteSecureItem(ACTIVE_ACCOUNT_KEY)
  }

  return updated
}

export function calculateGrandTotalVBucks(accounts: SavedAccount[]): {
  total: number
  complimentary: number
  purchased: number
} {
  return accounts.reduce(
    (acc, curr) => ({
      total: acc.total + (curr.vbucks?.total || 0),
      complimentary: acc.complimentary + (curr.vbucks?.complimentary || 0),
      purchased: acc.purchased + (curr.vbucks?.purchased || 0)
    }),
    { total: 0, complimentary: 0, purchased: 0 }
  )
}

/**
 * Universal Login Handler:
 * Accepts an authorization code, redirect URL, or exchange code.
 * Exchanges for access token, generates permanent device auth, and persists account.
 */
export async function loginWithCode(rawInput: string): Promise<{
  success: boolean
  session?: EpicAccountSession
  error?: string
}> {
  const code = extractCodeFromInput(rawInput)
  if (!code) {
    return { success: false, error: 'Invalid code. Please paste the 32-character code or full redirect URL.' }
  }

  const tokenUrl = 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token'

  // Attempt 1: Authorization Code with Android Client (primary)
  let tokenData: any = null
  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${ANDROID_AUTH}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code
      }).toString()
    })
    if (res.ok) {
      tokenData = await res.json()
    }
  } catch (err) {
    console.warn('Attempt 1 failed', err)
  }

  // Attempt 2: Authorization Code with iOS Client
  if (!tokenData) {
    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${IOS_AUTH}`
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code
        }).toString()
      })
      if (res.ok) {
        tokenData = await res.json()
      }
    } catch (err) {
      console.warn('Attempt 2 failed', err)
    }
  }

  // Attempt 3: Exchange Code with Switch Client
  if (!tokenData) {
    try {
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${SWITCH_AUTH}`
        },
        body: new URLSearchParams({
          grant_type: 'exchange_code',
          exchange_code: code
        }).toString()
      })
      if (res.ok) {
        tokenData = await res.json()
      }
    } catch (err) {
      console.warn('Attempt 3 failed', err)
    }
  }

  if (!tokenData || !tokenData.access_token || !tokenData.account_id) {
    return {
      success: false,
      error: 'Authentication failed. The code may be expired or already used. Please tap "Get Login Code" and paste a fresh code.'
    }
  }

  const accountId = tokenData.account_id
  const accessToken = tokenData.access_token
  const displayName = tokenData.displayName || 'Commander'
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 28800) * 1000).toISOString()

  // Generate permanent Device Auth credentials
  const deviceAuth = await createDeviceAuth(accessToken, accountId)

  // Fetch live V-Bucks
  const vbucks = await fetchAccountVbucks(accessToken, accountId)

  const session: EpicAccountSession = {
    accountId,
    displayName,
    accessToken,
    expiresAt,
    deviceId: deviceAuth?.deviceId,
    secret: deviceAuth?.secret,
    vbucksBalance: vbucks.total,
    vbucksDetail: vbucks
  }

  await addOrUpdateAccount(session, vbucks)
  return { success: true, session }
}

// Backward compatibility alias for existing callers
export async function loginWithExchangeCode(code: string): Promise<EpicAccountSession | null> {
  const result = await loginWithCode(code)
  return result.success ? (result.session || null) : null
}

export async function loadSavedSession(): Promise<EpicAccountSession | null> {
  try {
    const raw = await getSecureItem(ACTIVE_ACCOUNT_KEY)
    if (!raw) {
      // Check if accounts exist
      const accounts = await loadAllAccounts()
      if (accounts.length > 0) {
        const active = accounts.find((a) => a.isActive) || accounts[0]
        return {
          accountId: active.accountId,
          displayName: active.displayName,
          accessToken: active.accessToken,
          expiresAt: active.expiresAt,
          deviceId: active.deviceId,
          secret: active.secret,
          vbucksBalance: active.vbucks?.total || 0,
          vbucksDetail: active.vbucks
        }
      }
      return null
    }

    const session = JSON.parse(raw) as EpicAccountSession
    if (session.accountId && session.accountId.startsWith('demo-')) {
      await deleteSecureItem(ACTIVE_ACCOUNT_KEY)
      return null
    }

    // Check if token expired
    const isExpired = new Date(session.expiresAt).getTime() < Date.now() + 120000
    if (isExpired && session.deviceId && session.secret) {
      const refreshed = await refreshAccountWithDeviceAuth({
        accountId: session.accountId,
        displayName: session.displayName,
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        deviceId: session.deviceId,
        secret: session.secret,
        vbucks: session.vbucksDetail || { total: 0, complimentary: 0, purchased: 0 },
        isActive: true
      })
      if (refreshed) {
        const refreshedSession: EpicAccountSession = {
          accountId: refreshed.accountId,
          displayName: refreshed.displayName,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
          deviceId: refreshed.deviceId,
          secret: refreshed.secret,
          vbucksBalance: refreshed.vbucks.total,
          vbucksDetail: refreshed.vbucks
        }
        await saveSecureItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(refreshedSession))
        return refreshedSession
      }
    }

    return session
  } catch {
    return null
  }
}

export async function logoutSession(): Promise<void> {
  await deleteSecureItem(ACTIVE_ACCOUNT_KEY)
}
