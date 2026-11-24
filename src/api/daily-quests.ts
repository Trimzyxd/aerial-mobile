import { DailyQuest, AutoRerollConfig, AutoRerollSummary } from '../types'
import { getSecureItem, saveSecureItem } from '../utils/storage'

const AUTO_REROLL_STORAGE_KEY = 'aerial_auto_reroll_config'

export const DEFAULT_AUTOREROLL_CONFIG: AutoRerollConfig = {
  enabled: true,
  rerollLowVBucks: true,
  blacklistedKeywords: ['arcade', 'outlander', 'ninja', 'explore'],
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
      return JSON.parse(raw)
    }
  } catch (err) {
    console.warn('Failed to load auto-reroll config', err)
  }
  return DEFAULT_AUTOREROLL_CONFIG
}

export async function saveAutoRerollConfig(config: AutoRerollConfig): Promise<void> {
  await saveSecureItem(AUTO_REROLL_STORAGE_KEY, JSON.stringify(config))
}

export function evaluateBlacklist(quest: DailyQuest, config: AutoRerollConfig): { isBlacklisted: boolean; reason?: string } {
  // 1. Template match
  const tId = quest.templateId.toLowerCase().replace('quest:', '')
  if (config.blacklistedTemplates.some(b => tId.includes(b.toLowerCase()))) {
    return { isBlacklisted: true, reason: 'Blacklisted mission' }
  }

  // 2. Keyword match
  const text = `${quest.name} ${quest.description}`.toLowerCase()
  for (const kw of config.blacklistedKeywords) {
    const clean = kw.trim().toLowerCase()
    if (clean && text.includes(clean)) {
      return { isBlacklisted: true, reason: `Keyword: "${clean}"` }
    }
  }

  // 3. Low V-Bucks match
  if (config.rerollLowVBucks && quest.vbucksReward === 50) {
    return { isBlacklisted: true, reason: 'Low 50 V-Bucks' }
  }

  return { isBlacklisted: false }
}

export async function fetchDailyQuests(accessToken?: string, accountId?: string): Promise<DailyQuest[]> {
  const config = await loadAutoRerollConfig()

  if (!accessToken || !accountId) {
    return []
  }

  try {
    const url = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/ClientQuestLogin?profileId=campaign`
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
      console.warn('Failed to fetch Epic campaign profile')
      return []
    }

    const data = await res.json()
    const items = data?.profileChanges?.[0]?.profile?.items || {}
    const quests: DailyQuest[] = []

    for (const [key, item] of Object.entries<any>(items)) {
      if (item.templateId && item.templateId.toLowerCase().includes('quest:daily_')) {
        const attrs = item.attributes || {}
        if (attrs.quest_state === 'Active') {
          const vbucksReward = item.templateId.includes('all_together_now') ? 100 : (item.templateId.includes('60') ? 60 : 50)
          const questObj: DailyQuest = {
            id: key,
            templateId: item.templateId,
            name: attrs.quest_definition?.name || item.templateId.replace('Quest:', '').replace(/_/g, ' '),
            description: attrs.quest_definition?.description || 'Complete daily objective in Save the World.',
            progress: attrs.completion_keys?.[0] || 0,
            target: attrs.max_completion_keys?.[0] || 1,
            vbucksReward,
            canReroll: (data?.profileChanges?.[0]?.profile?.stats?.attributes?.daily_quest_rerolls || 0) > 0
          }
          const evalRes = evaluateBlacklist(questObj, config)
          questObj.isBlacklisted = evalRes.isBlacklisted
          questObj.blacklistReason = evalRes.reason
          quests.push(questObj)
        }
      }
    }

    return quests
  } catch (err) {
    console.warn('Network error querying daily quests', err)
    return []
  }
}

export async function rerollDailyQuest(questId: string, accessToken?: string, accountId?: string): Promise<{ success: boolean; message: string }> {
  if (!accessToken || !accountId) {
    return { success: false, message: 'Please sign in to an Epic Games account to reroll quests.' }
  }

  try {
    const url = `https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/profile/${accountId}/client/RerollDailyQuest?profileId=campaign`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ questId })
    })

    if (res.ok) {
      return { success: true, message: 'Daily quest rerolled successfully!' }
    }

    const errorJson = await res.json().catch(() => ({}))
    return { success: false, message: errorJson.errorMessage || 'Failed to reroll quest' }
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
        success: res.success
      })
      if (res.success) {
        summary.rerolledCount++
        // STW gives 1 daily reroll per day
        break
      }
    }
  }

  return summary
}
