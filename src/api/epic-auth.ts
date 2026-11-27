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

export async function fetchAccountVbucksStatus(
  accessToken: string,
  accountId: string
): Promise<{ ok: boolean; vbucks: VBucksDetail }> {
  const emptyVbucks: VBucksDetail = { total: 0, complimentary: 0, purchased: 0 }
  if (!accessToken || !accountId) {
    return { ok: false, vbucks: emptyVbucks }
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
      return { ok: false, vbucks: emptyVbucks }
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

    return { ok: true, vbucks: { total, complimentary, purchased } }
  } catch (err) {
    console.warn('Error fetching V-Bucks balance', err)
    return { ok: false, vbucks: emptyVbucks }
  }
}

export async function fetchAccountVbucks(accessToken: string, accountId: string): Promise<VBucksDetail> {
  const res = await fetchAccountVbucksStatus(accessToken, accountId)
  return res.vbucks
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
        'Content-Type': 'application/json',
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      },
      body: JSON.stringify({})
    })

    if (!res.ok) {
      console.warn(`Failed to create device auth credentials (HTTP ${res.status})`)
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
 * Tries Android client, then iOS client, then Switch client.
 */
export async function refreshAccountWithDeviceAuth(account: SavedAccount): Promise<SavedAccount | null> {
  if (!account.deviceId || !account.secret || !account.accountId) {
    return null
  }

  const clients = [ANDROID_AUTH, IOS_AUTH, SWITCH_AUTH]
  for (const clientAuth of clients) {
    try {
      const res = await fetch('https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${clientAuth}`,
          'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
        },
        body: new URLSearchParams({
          grant_type: 'device_auth',
          account_id: account.accountId,
          device_id: account.deviceId,
          secret: account.secret
        }).toString()
      })

      if (res.ok) {
        const data = await res.json()
        const newAccessToken = data.access_token
        const newExpiresAt = new Date(Date.now() + (data.expires_in || 28800) * 1000).toISOString()
        const vbucksRes = await fetchAccountVbucksStatus(newAccessToken, account.accountId)

        const updatedAccount: SavedAccount = {
          ...account,
          displayName: data.displayName || account.displayName,
          accessToken: newAccessToken,
          expiresAt: newExpiresAt,
          vbucks: vbucksRes.ok
            ? vbucksRes.vbucks
            : account.vbucks || { total: 0, complimentary: 0, purchased: 0 }
        }

        return updatedAccount
      }
    } catch (err) {
      console.warn('Failed device auth attempt with client', err)
    }
  }

  return null
}

function isTokenExpiredOrNear(expiresAt?: string, accessToken?: string): boolean {
  if (!accessToken || !expiresAt) return true
  const ms = new Date(expiresAt).getTime()
  return isNaN(ms) || ms < Date.now() + 300000
}

const refreshInFlight = new Map<string, Promise<SavedAccount | null>>()

/**
 * Forces a token refresh for a specific accountId using its stored Device Auth
 * and persists the fresh token across both saved accounts list and active session.
 * Coalesces concurrent refreshes for the same accountId to prevent SecureStore races.
 */
export function forceRefreshAccountToken(accountId: string): Promise<SavedAccount | null> {
  const existing = refreshInFlight.get(accountId)
  if (existing) {
    return existing
  }

  const run = (async (): Promise<SavedAccount | null> => {
    const accounts = await loadAllAccounts()
    let target = accounts.find((a) => a.accountId === accountId) || null

    // Fallback to ACTIVE_ACCOUNT_KEY if deviceId/secret only lived there
    let activeSession: EpicAccountSession | null = null
    try {
      const rawSession = await getSecureItem(ACTIVE_ACCOUNT_KEY)
      if (rawSession) {
        activeSession = JSON.parse(rawSession) as EpicAccountSession
      }
    } catch {
      activeSession = null
    }

    if (!target && activeSession?.accountId === accountId) {
      target = {
        accountId: activeSession.accountId,
        displayName: activeSession.displayName,
        accessToken: activeSession.accessToken,
        expiresAt: activeSession.expiresAt,
        deviceId: activeSession.deviceId,
        secret: activeSession.secret,
        vbucks: activeSession.vbucksDetail || { total: activeSession.vbucksBalance || 0, complimentary: 0, purchased: 0 },
        isActive: true
      }
    }

    if (!target) return null
    if ((!target.deviceId || !target.secret) && activeSession?.accountId === accountId) {
      target = {
        ...target,
        deviceId: target.deviceId || activeSession.deviceId,
        secret: target.secret || activeSession.secret
      }
    }

    const refreshed = await refreshAccountWithDeviceAuth(target)
    if (!refreshed) return null

    const latestAccounts = await loadAllAccounts()
    const updatedAccounts = latestAccounts.some((a) => a.accountId === accountId)
      ? latestAccounts.map((a) => (a.accountId === accountId ? { ...refreshed, isActive: a.isActive } : a))
      : [{ ...refreshed, isActive: true }, ...latestAccounts]

    await saveAllAccounts(updatedAccounts)

    if (refreshed.isActive || activeSession?.accountId === accountId) {
      const vbucks = refreshed.vbucks || { total: 0, complimentary: 0, purchased: 0 }
      await saveSecureItem(
        ACTIVE_ACCOUNT_KEY,
        JSON.stringify({
          accountId: refreshed.accountId,
          displayName: refreshed.displayName,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
          deviceId: refreshed.deviceId,
          secret: refreshed.secret,
          vbucksBalance: vbucks.total,
          vbucksDetail: vbucks
        } as EpicAccountSession)
      )
    }

    return refreshed
  })()

  refreshInFlight.set(accountId, run)
  run.finally(() => {
    refreshInFlight.delete(accountId)
  })
  return run
}

export async function refreshAllAccountsVbucks(currentAccounts?: SavedAccount[]): Promise<SavedAccount[]> {
  const baseList = currentAccounts && currentAccounts.length > 0 ? currentAccounts : await loadAllAccounts()
  if (baseList.length === 0) return []

  const results = await Promise.allSettled(
    baseList.map(async (acc): Promise<SavedAccount> => {
      const { accessToken, account } = await ensureValidToken(acc)
      const vb = await fetchAccountVbucksStatus(accessToken, account.accountId)
      return vb.ok ? { ...account, vbucks: vb.vbucks } : account
    })
  )

  const updated = results.map((r, i) => (r.status === 'fulfilled' ? r.value : baseList[i]))
  await saveAllAccounts(updated)

  const active = updated.find((a) => a.isActive)
  if (active) {
    await saveSecureItem(
      ACTIVE_ACCOUNT_KEY,
      JSON.stringify({
        accountId: active.accountId,
        displayName: active.displayName,
        accessToken: active.accessToken,
        expiresAt: active.expiresAt,
        deviceId: active.deviceId,
        secret: active.secret,
        vbucksBalance: active.vbucks?.total || 0,
        vbucksDetail: active.vbucks
      } as EpicAccountSession)
    )
  }

  return updated
}

export async function ensureValidToken(account: SavedAccount): Promise<{ accessToken: string; account: SavedAccount }> {
  if (isTokenExpiredOrNear(account.expiresAt, account.accessToken) && account.deviceId && account.secret) {
    const refreshed = await forceRefreshAccountToken(account.accountId)
    if (refreshed) {
      return { accessToken: refreshed.accessToken, account: refreshed }
    }
  }
  return { accessToken: account.accessToken, account }
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
  const cleanCurrent = current.filter(
    (a) => a.accountId && !a.accountId.startsWith('demo-') && a.displayName !== 'Commander Main'
  )
  const existingIndex = cleanCurrent.findIndex((a) => a.accountId === session.accountId)

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

  // Deactivate other accounts while preserving existing account order
  const updated = cleanCurrent.map((a) => ({ ...a, isActive: false }))
  if (existingIndex !== -1) {
    updated[existingIndex] = {
      ...updated[existingIndex],
      ...newAccount,
      deviceId: newAccount.deviceId || updated[existingIndex].deviceId,
      secret: newAccount.secret || updated[existingIndex].secret
    }
  } else {
    updated.unshift(newAccount)
  }

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

export async function reorderAccounts(
  fromIndex: number,
  toIndex: number,
  currentAccounts?: SavedAccount[]
): Promise<SavedAccount[]> {
  const list = [...(currentAccounts || (await loadAllAccounts()))]
  if (
    fromIndex < 0 ||
    fromIndex >= list.length ||
    toIndex < 0 ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list
  }

  const [moved] = list.splice(fromIndex, 1)
  list.splice(toIndex, 0, moved)
  await saveAllAccounts(list)
  return list
}

export async function switchActiveAccount(accountId: string): Promise<SavedAccount | null> {
  const accounts = await loadAllAccounts()
  let selected = accounts.find((a) => a.accountId === accountId) || null
  if (!selected) return null

  // Ensure fresh token when switching
  if (selected.deviceId && selected.secret && isTokenExpiredOrNear(selected.expiresAt, selected.accessToken)) {
    const refreshed = await refreshAccountWithDeviceAuth(selected)
    if (refreshed) {
      selected = refreshed
    }
  }

  const vbucks = selected.vbucks || { total: 0, complimentary: 0, purchased: 0 }
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
    vbucksBalance: vbucks.total,
    vbucksDetail: vbucks
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
    const accounts = await loadAllAccounts()
    const raw = await getSecureItem(ACTIVE_ACCOUNT_KEY)

    let session: EpicAccountSession | null = null
    if (raw) {
      const parsed = JSON.parse(raw) as EpicAccountSession
      if (parsed.accountId && parsed.accountId.startsWith('demo-')) {
        await deleteSecureItem(ACTIVE_ACCOUNT_KEY)
      } else {
        // Prefer latest saved account data if it exists (keeps credentials/order synced)
        const matchingAcc = accounts.find((a) => a.accountId === parsed.accountId)
        session = matchingAcc
          ? {
              accountId: matchingAcc.accountId,
              displayName: matchingAcc.displayName,
              accessToken: matchingAcc.accessToken,
              expiresAt: matchingAcc.expiresAt,
              deviceId: matchingAcc.deviceId || parsed.deviceId,
              secret: matchingAcc.secret || parsed.secret,
              vbucksBalance: matchingAcc.vbucks?.total ?? parsed.vbucksBalance ?? 0,
              vbucksDetail: matchingAcc.vbucks || parsed.vbucksDetail
            }
          : parsed
      }
    }

    if (!session && accounts.length > 0) {
      const active = accounts.find((a) => a.isActive) || accounts[0]
      session = {
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

    if (!session) return null

    if (isTokenExpiredOrNear(session.expiresAt, session.accessToken) && session.deviceId && session.secret) {
      const refreshed = await forceRefreshAccountToken(session.accountId)
      if (refreshed) {
        const vbucks = refreshed.vbucks || { total: 0, complimentary: 0, purchased: 0 }
        return {
          accountId: refreshed.accountId,
          displayName: refreshed.displayName,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
          deviceId: refreshed.deviceId,
          secret: refreshed.secret,
          vbucksBalance: vbucks.total,
          vbucksDetail: vbucks
        }
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
