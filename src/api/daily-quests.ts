import { DailyQuest, AutoRerollConfig, AutoRerollSummary, SavedAccount, AccountDailyQuestsGroup } from '../types'
import { getSecureItem, saveSecureItem } from '../utils/storage'
import { forceRefreshAccountToken, loadAllAccounts } from './epic-auth'

const AUTO_REROLL_STORAGE_KEY = 'aerial_auto_reroll_config'

export interface STWQuestDefinition {
  templateId: string
  name: string
  category: 'Destroy' | 'Scouting' | 'Husks & Weapons' | 'Mission Specialist' | 'Miscellaneous'
  target: number
  vbucks: number
}

export const STW_DAILY_QUESTS_CATALOG: STWQuestDefinition[] = [
  // Destroy Quests
  { templateId: 'daily_destroyarcademachines', name: 'Daily Destroy (Arcade Machines)', category: 'Destroy', target: 3, vbucks: 100 },
  { templateId: 'daily_destroybears', name: 'Daily Destroy (Teddy Bears)', category: 'Destroy', target: 8, vbucks: 100 },
  { templateId: 'daily_destroyfiretrucks', name: 'Daily Destroy (Fire Trucks)', category: 'Destroy', target: 3, vbucks: 100 },
  { templateId: 'daily_destroygnomes', name: 'Daily Destroy (Garden Gnomes)', category: 'Destroy', target: 3, vbucks: 100 },
  { templateId: 'daily_destroypropanetanks', name: 'Daily Destroy (Propane Tanks)', category: 'Destroy', target: 10, vbucks: 100 },
  { templateId: 'daily_destroyseesaws', name: 'Daily Destroy (Park Seesaws)', category: 'Destroy', target: 6, vbucks: 100 },
  { templateId: 'daily_destroyserverracks', name: 'Daily Destroy (Server Racks)', category: 'Destroy', target: 4, vbucks: 100 },
  { templateId: 'daily_destroytransformers', name: 'Daily Destroy (Transformers)', category: 'Destroy', target: 2, vbucks: 100 },
  { templateId: 'daily_destroytvs', name: 'Daily Destroy (TVs)', category: 'Destroy', target: 20, vbucks: 100 },

  // Scouting / Discovery Quests
  { templateId: 'daily_discovery_industriallocations', name: 'Daily Scouting (Industrial Construction)', category: 'Scouting', target: 3, vbucks: 100 },
  { templateId: 'daily_discovery_rurallocations', name: 'Daily Scouting (Rural Locations)', category: 'Scouting', target: 3, vbucks: 100 },
  { templateId: 'daily_discovery_shelters', name: 'Daily Scouting (Shelters)', category: 'Scouting', target: 4, vbucks: 100 },
  { templateId: 'daily_discovery_suburbanlocations', name: 'Daily Scouting (Suburbia)', category: 'Scouting', target: 10, vbucks: 100 },
  { templateId: 'daily_discovery_urbanlocations', name: 'Daily Scouting (Cities)', category: 'Scouting', target: 8, vbucks: 100 },
  { templateId: 'daily_explorezones', name: 'Exploration Party (Fully Explore Zones)', category: 'Scouting', target: 3, vbucks: 100 },

  // Husk Extermination & Weapon Quests
  { templateId: 'daily_huskextermination_anyhero', name: 'Husk Extermination (500 Husks - Any Hero)', category: 'Husks & Weapons', target: 500, vbucks: 100 },
  { templateId: 'daily_huskextermination_soldier', name: 'Husk Extermination (Soldier)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_ninja', name: 'Husk Extermination (Ninja)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_outlander', name: 'Husk Extermination (Outlander)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_constructor', name: 'Husk Extermination (Constructor)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_trap', name: 'Husk Extermination (Trap Kills)', category: 'Husks & Weapons', target: 150, vbucks: 100 },
  { templateId: 'daily_huskextermination_melee', name: 'Husk Extermination (Melee Weapon)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_ranged_assault', name: 'Husk Extermination (Assault Rifle)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_ranged_pistol', name: 'Husk Extermination (Pistol)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_ranged_shotgun', name: 'Husk Extermination (Shotgun)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_ranged_smg', name: 'Husk Extermination (SMG)', category: 'Husks & Weapons', target: 300, vbucks: 100 },
  { templateId: 'daily_huskextermination_ranged_sniper', name: 'Husk Extermination (Sniper Rifle)', category: 'Husks & Weapons', target: 300, vbucks: 100 },

  // Mission Specialist Quests
  { templateId: 'daily_mission_specialist_anyhero_1', name: 'Mission Specialist (3 Missions - Any Hero)', category: 'Mission Specialist', target: 3, vbucks: 100 },
  { templateId: 'daily_mission_specialist_anyhero_2', name: 'Mission Veteran (5 Missions - Any Hero)', category: 'Mission Specialist', target: 5, vbucks: 150 },
  { templateId: 'daily_mission_specialist_soldier', name: 'Mission Specialist (Soldier - 3 Missions)', category: 'Mission Specialist', target: 3, vbucks: 100 },
  { templateId: 'daily_mission_specialist_ninja', name: 'Mission Specialist (Ninja - 3 Missions)', category: 'Mission Specialist', target: 3, vbucks: 100 },
  { templateId: 'daily_mission_specialist_outlander', name: 'Mission Specialist (Outlander - 3 Missions)', category: 'Mission Specialist', target: 3, vbucks: 100 },
  { templateId: 'daily_mission_specialist_constructor', name: 'Mission Specialist (Constructor - 3 Missions)', category: 'Mission Specialist', target: 3, vbucks: 100 },
  { templateId: 'daily_mission_buildradar', name: 'Build the Radar Tower (4 Towers)', category: 'Mission Specialist', target: 4, vbucks: 100 },

  // Miscellaneous Quests
  { templateId: 'daily_high_priority', name: 'All Together Now (Play with Others)', category: 'Miscellaneous', target: 3, vbucks: 150 },
  { templateId: 'daily_partyof50', name: 'Party of 25 (Rescue 25 Survivors)', category: 'Miscellaneous', target: 25, vbucks: 100 },
  { templateId: 'daily_safes', name: 'Playing It Safe (Open 1 Safe)', category: 'Miscellaneous', target: 1, vbucks: 100 },
  { templateId: 'daily_treasurechests', name: 'Lost Treasures (Search 5 Chests)', category: 'Miscellaneous', target: 5, vbucks: 100 }
]

export function getQuestCatalogEntry(rawTemplateId: string): STWQuestDefinition | null {
  const clean = rawTemplateId.toLowerCase().replace(/^quest:/, '')
  return (
    STW_DAILY_QUESTS_CATALOG.find((q) => clean === q.templateId.toLowerCase()) ||
    STW_DAILY_QUESTS_CATALOG.find((q) => clean.includes(q.templateId.toLowerCase())) ||
    null
  )
}

export const DEFAULT_AUTOREROLL_CONFIG: AutoRerollConfig = {
  enabled: true,
  rerollLowVBucks: false,
  blacklistedKeywords: [],
  blacklistedTemplates: [
    'daily_explorezones',
    'daily_destroyarcademachines',
    'daily_mission_specialist_outlander',
    'daily_mission_specialist_ninja'
  ]
}

export async function loadAutoRerollConfig(): Promise<AutoRerollConfig> {
  try {
    const raw = await getSecureItem(AUTO_REROLL_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        ...DEFAULT_AUTOREROLL_CONFIG,
        ...parsed,
        blacklistedTemplates: Array.isArray(parsed.blacklistedTemplates)
          ? parsed.blacklistedTemplates
          : DEFAULT_AUTOREROLL_CONFIG.blacklistedTemplates,
        blacklistedKeywords: Array.isArray(parsed.blacklistedKeywords) ? parsed.blacklistedKeywords : []
      }
    }
  } catch (err) {
    console.warn('Failed to load auto-reroll config', err)
  }
  return DEFAULT_AUTOREROLL_CONFIG
}

export async function saveAutoRerollConfig(config: AutoRerollConfig): Promise<void> {
  await saveSecureItem(AUTO_REROLL_STORAGE_KEY, JSON.stringify(config))
}

export function evaluateBlacklist(
  quest: DailyQuest,
  config: AutoRerollConfig
): { isBlacklisted: boolean; reason?: string } {
  // 1. Direct template ID match from checklist picker
  const cleanTid = quest.templateId.toLowerCase().replace(/^quest:/, '')
  if (
    config.blacklistedTemplates &&
    config.blacklistedTemplates.some((b) => {
      const cleanB = b.toLowerCase().replace(/^quest:/, '')
      return cleanTid === cleanB || (cleanB.length > 0 && cleanTid.startsWith(cleanB))
    })
  ) {
    const catalog = getQuestCatalogEntry(quest.templateId)
    return { isBlacklisted: true, reason: catalog ? catalog.name : 'Blacklisted quest' }
  }

  // 2. Optional custom keyword match
  const text = `${quest.name} ${quest.description} ${cleanTid}`.toLowerCase()
  if (config.blacklistedKeywords) {
    for (const kw of config.blacklistedKeywords) {
      const clean = kw.trim().toLowerCase()
      if (clean && text.includes(clean)) {
        return { isBlacklisted: true, reason: `Keyword: "${clean}"` }
      }
    }
  }

  // 3. Low V-Bucks match (aim for 150 VB quests)
  if (config.rerollLowVBucks && quest.vbucksReward < 150) {
    return { isBlacklisted: true, reason: `Non-150 VB (${quest.vbucksReward} VB)` }
  }

  return { isBlacklisted: false }
}

function parseProgress(attributes: Record<string, any>): number {
  const completionSum = Object.entries(attributes)
    .filter(([key, value]) => key.startsWith('completion_') && typeof value === 'number')
    .reduce((acc, [, value]) => acc + (value as number), 0)

  if (completionSum > 0) return completionSum
  if (Array.isArray(attributes.completion_keys) && typeof attributes.completion_keys[0] === 'number') {
    return attributes.completion_keys[0]
  }
  return 0
}

export interface DailyQuestsFetchResult {
  quests: DailyQuest[]
  rerollsRemaining: number
  refreshedAccessToken?: string
  error?: string
  needsRelogin?: boolean
}

export async function fetchDailyQuestsWithStatus(
  accessToken?: string,
  accountId?: string
): Promise<DailyQuestsFetchResult> {
  const config = await loadAutoRerollConfig()

  if (!accountId) {
    return { quests: [], rerollsRemaining: 0 }
  }

  // Look up freshest token from stored accounts in case React state lags behind storage
  let currentToken = accessToken || ''
  if (!currentToken) {
    const allAccounts = await loadAllAccounts()
    currentToken = allAccounts.find((a) => a.accountId === accountId)?.accessToken || ''
  }

  const queryCampaignProfile = async (token: string, id: string) => {
    const url = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${id}/client/QueryProfile?profileId=campaign&rvn=-1`
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      },
      body: JSON.stringify({})
    })

    if (!response.ok && response.status !== 401 && response.status !== 403) {
      const fallbackUrl = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${id}/client/ClientQuestLogin?profileId=campaign`
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
        },
        body: JSON.stringify({})
      })
    }

    return response
  }

  try {
    let refreshedToken: string | undefined
    if (!currentToken) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (!refreshed) {
        return {
          quests: [],
          rerollsRemaining: 0,
          needsRelogin: true,
          error: 'Session missing or expired. Re-connect this account in the Account tab.'
        }
      }
      currentToken = refreshed.accessToken
      refreshedToken = refreshed.accessToken
    }

    let res = await queryCampaignProfile(currentToken, accountId)

    // Auto-refresh token if expired or rejected (401/403)
    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed) {
        currentToken = refreshed.accessToken
        refreshedToken = refreshed.accessToken
        res = await queryCampaignProfile(currentToken, accountId)
      }
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      const errMsg = errBody?.errorMessage || errBody?.errorCode || `Epic API returned HTTP ${res.status}`
      return {
        quests: [],
        rerollsRemaining: 0,
        refreshedAccessToken: refreshedToken,
        needsRelogin: res.status === 401 || res.status === 403,
        error: errMsg
      }
    }

    const data = await res.json()
    const profileChange =
      data?.profileChanges?.find((c: any) => c?.profile)?.profile ||
      data?.profileChanges?.[0]?.profile
    const items = profileChange?.items || {}
    const stats = profileChange?.stats?.attributes || {}
    const rerolls = Number(stats?.quest_manager?.dailyQuestRerolls ?? stats?.daily_quest_rerolls ?? 0)

    const quests: DailyQuest[] = []

    for (const [key, item] of Object.entries<any>(items)) {
      if (item?.templateId && item.templateId.toLowerCase().startsWith('quest:daily_')) {
        const attrs = item.attributes || {}
        if (String(attrs.quest_state || '').toLowerCase() === 'active') {
          const catalog = getQuestCatalogEntry(item.templateId)
          const vbucksReward = catalog
            ? catalog.vbucks
            : item.templateId.includes('high_priority') || item.templateId.includes('anyhero_2')
            ? 150
            : 100

          const questObj: DailyQuest = {
            id: key,
            templateId: item.templateId,
            name: catalog?.name || attrs.quest_definition?.name || item.templateId.replace(/^Quest:/i, '').replace(/_/g, ' '),
            description:
              attrs.quest_definition?.description ||
              (catalog ? `Target: ${catalog.target} (${catalog.category})` : 'Complete daily objective in Save the World.'),
            progress: parseProgress(attrs),
            target: catalog?.target || attrs.max_completion_keys?.[0] || 1,
            vbucksReward,
            canReroll: rerolls > 0
          }
          const evalRes = evaluateBlacklist(questObj, config)
          questObj.isBlacklisted = evalRes.isBlacklisted
          questObj.blacklistReason = evalRes.reason
          quests.push(questObj)
        }
      }
    }

    return {
      quests,
      rerollsRemaining: rerolls,
      refreshedAccessToken: refreshedToken
    }
  } catch (err: any) {
    return {
      quests: [],
      rerollsRemaining: 0,
      error: err?.message || 'Network error querying Epic campaign profile.'
    }
  }
}

export async function fetchDailyQuests(accessToken?: string, accountId?: string): Promise<DailyQuest[]> {
  const result = await fetchDailyQuestsWithStatus(accessToken, accountId)
  return result.quests
}

export async function fetchAllAccountsDailyQuests(
  accounts: SavedAccount[]
): Promise<{ groups: AccountDailyQuestsGroup[]; refreshedTokens: Record<string, string> }> {
  if (!accounts || accounts.length === 0) {
    return { groups: [], refreshedTokens: {} }
  }

  const refreshedTokens: Record<string, string> = {}
  const settled = await Promise.allSettled(
    accounts.map(async (acc): Promise<AccountDailyQuestsGroup> => {
      const res = await fetchDailyQuestsWithStatus(acc.accessToken, acc.accountId)
      if (res.refreshedAccessToken) {
        refreshedTokens[acc.accountId] = res.refreshedAccessToken
      }
      return {
        accountId: acc.accountId,
        displayName: acc.displayName,
        quests: res.quests,
        rerollsRemaining: res.rerollsRemaining,
        error: res.error,
        needsRelogin: res.needsRelogin
      }
    })
  )

  const groups: AccountDailyQuestsGroup[] = settled.map((item, idx) => {
    const acc = accounts[idx]
    if (item.status === 'fulfilled') {
      return item.value
    }
    return {
      accountId: acc.accountId,
      displayName: acc.displayName,
      quests: [],
      rerollsRemaining: 0,
      error: item.reason?.message || 'Failed to fetch account quests'
    }
  })

  return { groups, refreshedTokens }
}

export async function rerollDailyQuest(
  questId: string,
  accessToken?: string,
  accountId?: string
): Promise<{ success: boolean; message: string }> {
  if (!accessToken || !accountId) {
    return { success: false, message: 'Please sign in to an Epic Games account to reroll quests.' }
  }

  const sendReroll = async (token: string, id: string) => {
    const url = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${id}/client/FortRerollDailyQuest?profileId=campaign&rvn=-1`
    return fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      },
      body: JSON.stringify({ questId })
    })
  }

  try {
    let currentToken = accessToken
    let res = await sendReroll(currentToken, accountId)

    if (res.status === 401 || res.status === 403) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed) {
        currentToken = refreshed.accessToken
        res = await sendReroll(currentToken, accountId)
      }
    }

    if (res.ok) {
      return { success: true, message: 'Daily quest rerolled successfully!' }
    }

    const errorJson = await res.json().catch(() => ({}))
    return { success: false, message: errorJson.errorMessage || `Failed to reroll quest (HTTP ${res.status})` }
  } catch (err: any) {
    return { success: false, message: err.message || 'Network error' }
  }
}

export async function executeAutoReroll(
  quests: DailyQuest[],
  config: AutoRerollConfig,
  accessToken?: string,
  accountId?: string
): Promise<AutoRerollSummary> {
  const summary: AutoRerollSummary = {
    success: true,
    rerolledCount: 0,
    details: []
  }

  for (const quest of quests) {
    const evalResult = evaluateBlacklist(quest, config)
    if (evalResult.isBlacklisted && quest.canReroll) {
      const res = await rerollDailyQuest(quest.id, accessToken, accountId)
      summary.details.push({
        questName: quest.name,
        reason: evalResult.reason || 'Blacklisted',
        success: res.success,
        message: res.message
      })
      if (res.success) {
        summary.rerolledCount++
        // STW grants 1 reroll per day
        break
      }
    }
  }

  return summary
}

export async function executeAutoRerollAllAccounts(
  groups: AccountDailyQuestsGroup[],
  config: AutoRerollConfig,
  accounts: SavedAccount[]
): Promise<AutoRerollSummary> {
  const summary: AutoRerollSummary = {
    success: true,
    rerolledCount: 0,
    details: []
  }

  // Pull latest saved accounts so auto-refreshed tokens are up to date
  const storedAccounts = await loadAllAccounts()

  for (const group of groups) {
    if (group.error || group.rerollsRemaining <= 0 || group.quests.length === 0) {
      continue
    }

    const accountObj =
      storedAccounts.find((a) => a.accountId === group.accountId) ||
      accounts.find((a) => a.accountId === group.accountId)
    if (!accountObj) continue

    let remaining = group.rerollsRemaining
    for (const quest of group.quests) {
      if (remaining <= 0) break
      const evalResult = evaluateBlacklist(quest, config)
      if (!evalResult.isBlacklisted) continue

      const res = await rerollDailyQuest(quest.id, accountObj.accessToken, group.accountId)
      summary.details.push({
        accountName: group.displayName,
        questName: quest.name,
        reason: evalResult.reason || 'Blacklisted',
        success: res.success,
        message: res.message
      })
      if (res.success) {
        summary.rerolledCount++
        remaining--
      } else {
        summary.success = false
        break
      }
    }
  }

  return summary
}
