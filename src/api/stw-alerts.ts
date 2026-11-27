import { MissionAlert, MissionReward } from '../types'
import { forceRefreshAccountToken } from './epic-auth'

export interface FetchAlertsResult {
  alerts: MissionAlert[]
  error?: string
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 25000): Promise<Response> {
  if (typeof AbortController === 'undefined') {
    return fetch(url, init)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function parseWorldInfoData(data: any): MissionAlert[] {
  const theatersMap: Record<string, { name: string; index: number }> = {}

  if (Array.isArray(data?.theaters)) {
    data.theaters.forEach((th: any, idx: number) => {
      const id = th?.uniqueId || th?.theaterId
      if (id) {
        theatersMap[id] = {
          name: th.displayName || th.name || `Zone ${idx + 1}`,
          index: idx
        }
      }
    })
  }

  const alertsList: MissionAlert[] = []
  if (Array.isArray(data?.missionAlerts)) {
    for (const alertGroup of data.missionAlerts) {
      const theaterId = alertGroup?.theaterId
      const zoneInfo = theatersMap[theaterId] || { name: 'Save The World', index: 0 }
      const available = alertGroup?.availableMissionAlerts || []

      for (const item of available) {
        const rawRewards = item?.missionAlertRewards?.items || []
        const rewards: MissionReward[] = rawRewards.map((r: any) => {
          const itemType = String(r?.itemType || '').toLowerCase()
          const isVBucks = itemType.includes('mtx') || itemType.includes('vbucks')
          const qty = Number(r?.quantity ?? 1)
          const displayName = isVBucks
            ? `${qty} V-Bucks`
            : String(r?.itemType || '').split(':').pop()?.replace(/_/g, ' ') || 'Reward'
          return {
            templateId: r?.itemType,
            quantity: qty,
            isVBucks,
            displayName
          }
        })

        alertsList.push({
          id: item?.missionAlertGuid || item?.name || `${theaterId}-${item?.tileIndex ?? alertsList.length}`,
          zone: zoneInfo.name,
          zoneIndex: zoneInfo.index,
          powerLevel: Number(item?.tileIndex ?? 50),
          missionName: String(item?.categoryName || item?.name || 'Mission Alert').replace(/_/g, ' '),
          missionType: item?.categoryName?.includes('Storm') ? 'Mutant Storm' : 'Alert Mission',
          rewards,
          expiresAt: item?.availableUntil || new Date(Date.now() + 12 * 3600000).toISOString()
        })
      }
    }
  }

  return alertsList
}

/**
 * Parses STW World Info from https://stw.news (Next.js React Server Component stream)
 */
async function fetchFromStwNews(): Promise<{ alerts: MissionAlert[]; error?: string }> {
  try {
    const res = await fetchWithTimeout(
      'https://stw.news',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      },
      25000
    )

    if (!res.ok) {
      return { alerts: [], error: `stw.news returned HTTP ${res.status}` }
    }

    const html = await res.text()

    // Next.js streams RSC chunks inside `self.__next_f.push([1,"..."])`
    const pattern = /self\.__next_f\.push\(\[\d+,\s*"([\s\S]*?)"\]\)/g
    let fullStream = ''
    let match: RegExpExecArray | null
    while ((match = pattern.exec(html)) !== null) {
      try {
        fullStream += JSON.parse(`"${match[1]}"`)
      } catch {
        fullStream += match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      }
    }

    const theaterIdx = fullStream.indexOf('{"theaters":')
    if (theaterIdx === -1) {
      return { alerts: [], error: 'stw.news did not contain STW mission stream' }
    }

    let depth = 0
    let endIdx = -1
    for (let i = theaterIdx; i < fullStream.length; i++) {
      if (fullStream[i] === '{') depth++
      else if (fullStream[i] === '}') {
        depth--
        if (depth === 0) {
          endIdx = i + 1
          break
        }
      }
    }

    if (endIdx === -1) {
      return { alerts: [], error: 'stw.news mission payload truncated' }
    }

    const data = JSON.parse(fullStream.slice(theaterIdx, endIdx))
    const alertsList = parseWorldInfoData(data)
    if (alertsList.length === 0) {
      return { alerts: [], error: 'stw.news returned 0 mission alerts' }
    }
    return { alerts: alertsList }
  } catch (err: any) {
    const msg =
      err?.name === 'AbortError'
        ? 'stw.news request timed out'
        : err?.message || 'Failed to load alerts from stw.news'
    console.warn('Error extracting alerts from stw.news', msg)
    return { alerts: [], error: msg }
  }
}

/**
 * Fetches STW World Info directly from Epic Games authenticated endpoint
 */
async function fetchFromEpicGames(
  accessToken: string,
  accountId?: string
): Promise<{ alerts: MissionAlert[]; error?: string }> {
  const url = 'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/world/info'
  const doGet = (token: string) =>
    fetchWithTimeout(
      url,
      {
        headers: {
          Authorization: `bearer ${token}`,
          'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows',
          Accept: 'application/json'
        }
      },
      20000
    )

  try {
    let res = await doGet(accessToken)
    if ((res.status === 401 || res.status === 403) && accountId) {
      const refreshed = await forceRefreshAccountToken(accountId)
      if (refreshed?.accessToken) {
        res = await doGet(refreshed.accessToken)
      }
    }

    if (!res.ok) {
      return { alerts: [], error: `Epic world/info HTTP ${res.status}` }
    }

    const data = await res.json()
    const alertsList = parseWorldInfoData(data)
    if (alertsList.length === 0) {
      return { alerts: [], error: 'Epic world/info returned 0 mission alerts' }
    }
    return { alerts: alertsList }
  } catch (err: any) {
    const msg =
      err?.name === 'AbortError'
        ? 'Epic world/info timed out'
        : err?.message || 'Failed to reach Epic world/info'
    console.warn('Error fetching alerts from Epic Games', msg)
    return { alerts: [], error: msg }
  }
}

export async function fetchMissionAlerts(
  accessToken?: string,
  accountId?: string
): Promise<FetchAlertsResult> {
  const errors: string[] = []

  // 1. Primary when signed in: direct Epic Games world/info JSON (~300 KB vs 2.3 MB HTML)
  if (accessToken) {
    const epicRes = await fetchFromEpicGames(accessToken, accountId)
    if (epicRes.alerts.length > 0) {
      return { alerts: epicRes.alerts }
    }
    if (epicRes.error) errors.push(epicRes.error)
  }

  // 2. Public / fallback source: stw.news
  const stwNewsRes = await fetchFromStwNews()
  if (stwNewsRes.alerts.length > 0) {
    return { alerts: stwNewsRes.alerts }
  }
  if (stwNewsRes.error) errors.push(stwNewsRes.error)

  return {
    alerts: [],
    error: errors.join(' · ') || 'Could not load STW mission alerts.'
  }
}
