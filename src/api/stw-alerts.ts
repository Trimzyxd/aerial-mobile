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

const WORLD_POWER_LEVELS: Record<string, Record<string, number>> = {
  '33A2311D4AE64B361CCE27BC9F313C8B': {
    Start_Zone1: 1,
    Start_Zone2: 3,
    Start_Zone3: 5,
    Start_Zone4: 9,
    Start_Zone5: 15,
    Normal_Zone1: 19
  },
  D477605B4FA48648107B649CE97FCF27: {
    Normal_Zone1: 19,
    Normal_Zone2: 23,
    Normal_Zone3: 28,
    Normal_Zone4: 34,
    Normal_Zone5: 40,
    Hard_Zone1: 46
  },
  E6ECBD064B153234656CB4BDE6743870: {
    Hard_Zone1: 46,
    Hard_Zone2: 52,
    Hard_Zone3: 58,
    Hard_Zone4: 64,
    Hard_Zone5: 70
  },
  D9A801C5444D1C74D1B7DAB5C7C12C5B: {
    Nightmare_Zone1: 76,
    Nightmare_Zone2: 82,
    Nightmare_Zone3: 88,
    Nightmare_Zone4: 94,
    Nightmare_Zone5: 100,
    Endgame_Zone1: 108,
    Endgame_Zone2: 116,
    Endgame_Zone3: 124,
    Endgame_Zone4: 132,
    Endgame_Zone5: 140,
    Endgame_Zone6: 160
  },
  ventures: {
    Phoenix_Zone02: 3,
    Phoenix_Zone03: 5,
    Phoenix_Zone05: 15,
    Phoenix_Zone07: 23,
    Phoenix_Zone09: 34,
    Phoenix_Zone11: 46,
    Phoenix_Zone13: 58,
    Phoenix_Zone15: 70,
    Phoenix_Zone17: 82,
    Phoenix_Zone19: 94,
    Phoenix_Zone21: 108,
    Phoenix_Zone23: 124,
    Phoenix_Zone25: 140
  }
}

const FALLBACK_ZONE_LEVELS: Record<string, number> = Object.assign(
  {},
  ...Object.values(WORLD_POWER_LEVELS)
)

function resolveMissionPowerLevel(theaterId: string, rowName?: string, tileIndex?: number): number {
  if (!rowName) return Number(tileIndex ?? 50)
  const normalized = rowName
    .replace(/^Theater_/, '')
    .replace(/^Endless_/, '')
    .replace(/_Group_/, '_')
    .replace(/_Dudebro$/i, '')

  const byTheater = WORLD_POWER_LEVELS[theaterId]?.[normalized]
  if (typeof byTheater === 'number') return byTheater
  if (normalized.startsWith('Phoenix_') && typeof WORLD_POWER_LEVELS.ventures[normalized] === 'number') {
    return WORLD_POWER_LEVELS.ventures[normalized]
  }
  if (typeof FALLBACK_ZONE_LEVELS[normalized] === 'number') {
    return FALLBACK_ZONE_LEVELS[normalized]
  }
  if (normalized.includes('Endgame')) return 140
  if (normalized.includes('Nightmare')) return 100
  if (normalized.includes('Hard')) return 70
  if (normalized.includes('Normal')) return 34
  if (normalized.includes('Start')) return 15
  return Number(tileIndex ?? 50)
}

function formatMissionGeneratorName(generator?: string, fallbackName?: string): string {
  const g = String(generator || '').toLowerCase()
  if (g.includes('1gate') || g.includes('cat1fts')) return 'Fight the Storm'
  if (g.includes('2gates')) return 'Fight Category 2 Storm'
  if (g.includes('3gates')) return 'Fight Category 3 Storm'
  if (g.includes('4gates')) return 'Fight Category 4 Storm'
  if (g.includes('rtl') || g.includes('ridethelightning')) return 'Ride the Lightning'
  if (g.includes('rtd') || g.includes('retrievethedata') || g.includes('launchtheballoon')) return 'Retrieve the Data'
  if (g.includes('etshelter')) return 'Evacuate the Shelter'
  if (g.includes('rts')) return 'Repair the Shelter'
  if (g.includes('dtb')) return 'Deliver the Bomb'
  if (g.includes('dte') || g.includes('destroytheencampments')) return 'Destroy the Encampments'
  if (g.includes('etsurvivors') || g.includes('evacuatethesurvivors')) return 'Rescue the Survivors'
  if (g.includes('buildtheradar')) return 'Build the Radar Grid'
  if (g.includes('resupply')) return 'Resupply'
  if (g.includes('eliminateandcollect')) return 'Eliminate and Collect'
  if (g.includes('refuelthebase')) return 'Refuel the Homebase'
  if (g.includes('pts')) return 'Protect the Servers'
  if (g.includes('theoutpost')) return 'Storm Shield Defense'
  return String(fallbackName || 'Mission Alert').replace(/_/g, ' ')
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

  const missionLookup = new Map<string, { rowName?: string; missionGenerator?: string }>()
  if (Array.isArray(data?.missions)) {
    for (const missionGroup of data.missions) {
      const theaterId = missionGroup?.theaterId
      if (!theaterId) continue
      for (const m of missionGroup?.availableMissions || []) {
        if (m?.tileIndex === undefined || m?.tileIndex === null) continue
        missionLookup.set(`${theaterId}:${m.tileIndex}`, {
          rowName: m?.missionDifficultyInfo?.rowName,
          missionGenerator: m?.missionGenerator
        })
      }
    }
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

        const meta = missionLookup.get(`${theaterId}:${item?.tileIndex}`)
        const rowName = meta?.rowName
        const isGroup = Boolean(rowName && rowName.includes('_Group'))
        const isStorm = String(item?.categoryName || '').includes('Storm')
        const missionType = isGroup
          ? isStorm
            ? '4-Player · Mutant Storm'
            : '4-Player Group'
          : isStorm
            ? 'Mutant Storm'
            : 'Alert Mission'

        alertsList.push({
          id: item?.missionAlertGuid || item?.name || `${theaterId}-${item?.tileIndex ?? alertsList.length}`,
          zone: zoneInfo.name,
          zoneIndex: zoneInfo.index,
          powerLevel: resolveMissionPowerLevel(theaterId, rowName, item?.tileIndex),
          missionName: formatMissionGeneratorName(meta?.missionGenerator, item?.categoryName || item?.name),
          missionType,
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
