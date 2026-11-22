import { EpicAccountSession, SavedAccount, VBucksDetail } from '../types'
import { saveSecureItem, getSecureItem, deleteSecureItem } from '../utils/storage'

// Standard Epic Switch client credentials (publicly used for exchange codes)
const SWITCH_CLIENT_ID = '3446270ad57743c681c780b184e49e94'
const SWITCH_CLIENT_SECRET = 'Z3dhS0ptUHZoV0h1TVVHQzBNV0h1TVVHQzBNV0h1TVU='

const SAVED_ACCOUNTS_KEY = 'aerial_saved_accounts'
const ACTIVE_ACCOUNT_KEY = 'epic_session'

export const DEMO_ACCOUNTS: SavedAccount[] = [
  {
    accountId: 'demo-main-01',
    displayName: 'Commander Main',
    accessToken: 'demo-token-1',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    isActive: true,
    vbucks: {
      total: 3450,
      complimentary: 2450,
      purchased: 1000
    }
  },
  {
    accountId: 'demo-alt-02',
    displayName: 'STW Alt Account',
    accessToken: 'demo-token-2',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    isActive: false,
    vbucks: {
      total: 2150,
      complimentary: 2150,
      purchased: 0
    }
  }
]

export async function fetchAccountVbucks(accessToken: string, accountId: string): Promise<VBucksDetail> {
  if (!accessToken || !accountId || accessToken.startsWith('demo-')) {
    return {
      total: 3450,
      complimentary: 2450,
      purchased: 1000
    }
  }

  try {
    const url = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/QueryProfile?profileId=common_core`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })

    if (!res.ok) {
      console.warn('Failed to query common_core profile for V-Bucks')
      return { total: 0, complimentary: 0, purchased: 0 }
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
    return { total: 0, complimentary: 0, purchased: 0 }
  }
}

export async function loadAllAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await getSecureItem(SAVED_ACCOUNTS_KEY)
    if (!raw) return DEMO_ACCOUNTS
    const accounts: SavedAccount[] = JSON.parse(raw)
    return accounts.length > 0 ? accounts : DEMO_ACCOUNTS
  } catch {
    return DEMO_ACCOUNTS
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
  const filtered = current.filter((a) => a.accountId !== session.accountId && !a.accountId.startsWith('demo-'))

  const newAccount: SavedAccount = {
    accountId: session.accountId,
    displayName: session.displayName,
    accessToken: session.accessToken,
    expiresAt: session.expiresAt,
    vbucks,
    isActive: true
  }

  // Deactivate others
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
  let selected: SavedAccount | null = null

  const updated = accounts.map((acc) => {
    if (acc.accountId === accountId) {
      selected = { ...acc, isActive: true }
      return selected
    }
    return { ...acc, isActive: false }
  })

  if (selected) {
    await saveAllAccounts(updated)
    const session: EpicAccountSession = {
      accountId: (selected as SavedAccount).accountId,
      displayName: (selected as SavedAccount).displayName,
      accessToken: (selected as SavedAccount).accessToken,
      expiresAt: (selected as SavedAccount).expiresAt,
      vbucksBalance: (selected as SavedAccount).vbucks.total,
      vbucksDetail: (selected as SavedAccount).vbucks
    }
    await saveSecureItem(ACTIVE_ACCOUNT_KEY, JSON.stringify(session))
  }

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

export async function loginWithExchangeCode(code: string): Promise<EpicAccountSession | null> {
  try {
    const res = await fetch('https://account-public-service-prod.ol.epicgames.com/account/api/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${SWITCH_CLIENT_ID}:${SWITCH_CLIENT_SECRET}`)}`
      },
      body: new URLSearchParams({
        grant_type: 'exchange_code',
        exchange_code: code
      }).toString()
    })

    if (!res.ok) {
      console.warn('OAuth token exchange failed')
      return null
    }

    const data = await res.json()
    const accountId = data.account_id
    const accessToken = data.access_token
    const displayName = data.displayName || 'Commander'
    const expiresAt = new Date(Date.now() + (data.expires_in || 28800) * 1000).toISOString()

    const vbucks = await fetchAccountVbucks(accessToken, accountId)

    const session: EpicAccountSession = {
      accountId,
      displayName,
      accessToken,
      expiresAt,
      vbucksBalance: vbucks.total,
      vbucksDetail: vbucks
    }

    await addOrUpdateAccount(session, vbucks)
    return session
  } catch (err) {
    console.warn('Failed loginWithExchangeCode', err)
    return null
  }
}

export async function loadSavedSession(): Promise<EpicAccountSession | null> {
  try {
    const raw = await getSecureItem(ACTIVE_ACCOUNT_KEY)
    if (!raw) {
      // Default to first demo account if no active session
      const demo = DEMO_ACCOUNTS[0]
      return {
        accountId: demo.accountId,
        displayName: demo.displayName,
        accessToken: demo.accessToken,
        expiresAt: demo.expiresAt,
        vbucksBalance: demo.vbucks.total,
        vbucksDetail: demo.vbucks
      }
    }
    return JSON.parse(raw) as EpicAccountSession
  } catch {
    return null
  }
}

export async function logoutSession(): Promise<void> {
  await deleteSecureItem(ACTIVE_ACCOUNT_KEY)
}
