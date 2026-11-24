import { MissionAlert, MissionReward } from '../types'

/**
 * Parses STW World Info from https://stw.news (Next.js React Server Component stream)
 */
async function fetchFromStwNews(): Promise<MissionAlert[] | null> {
  try {
    const res = await fetch('https://stw.news', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })

    if (!res.ok) return null

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
    if (theaterIdx === -1) return null

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

    if (endIdx === -1) return null

    const data = JSON.parse(fullStream.slice(theaterIdx, endIdx))
    const theatersMap: Record<string, { name: string; index: number }> = {}

    if (Array.isArray(data.theaters)) {
      data.theaters.forEach((th: any, idx: number) => {
        const id = th.uniqueId || th.theaterId
        if (id) {
          theatersMap[id] = {
            name: th.displayName || th.name || `Zone ${idx + 1}`,
            index: idx
          }
        }
      })
    }

    const alertsList: MissionAlert[] = []

    if (Array.isArray(data.missionAlerts)) {
      for (const alertGroup of data.missionAlerts) {
        const theaterId = alertGroup.theaterId
        const zoneInfo = theatersMap[theaterId] || { name: 'Save The World', index: 0 }
        const available = alertGroup.availableMissionAlerts || []

        for (const item of available) {
          const rawRewards = item?.missionAlertRewards?.items || []
          const rewards: MissionReward[] = rawRewards.map((r: any) => {
            const itemType = (r.itemType || '').toLowerCase()
            const isVBucks = itemType.includes('mtx') || itemType.includes('vbucks')
            const qty = r.quantity || 1
            const displayName = isVBucks
              ? `${qty} V-Bucks`
              : (r.itemType || '').split(':').pop()?.replace(/_/g, ' ') || 'Reward'
            return {
              templateId: r.itemType,
              quantity: qty,
              isVBucks,
              displayName
            }
          })

          alertsList.push({
            id: item.missionAlertGuid || item.name || String(Math.random()),
            zone: zoneInfo.name,
            zoneIndex: zoneInfo.index,
            powerLevel: item.tileIndex || 50,
            missionName: (item.categoryName || item.name || 'Mission Alert').replace(/_/g, ' '),
            missionType: item.categoryName?.includes('Storm') ? 'Mutant Storm' : 'Alert Mission',
            rewards,
            expiresAt: item.availableUntil || new Date(Date.now() + 12 * 3600000).toISOString()
          })
        }
      }
    }

    return alertsList.length > 0 ? alertsList : null
  } catch (err) {
    console.warn('Error extracting alerts from stw.news', err)
    return null
  }
}

/**
 * Fetches STW World Info directly from Epic Games authenticated endpoint
 */
async function fetchFromEpicGames(accessToken: string): Promise<MissionAlert[] | null> {
  try {
    const res = await fetch('https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2/world/info', {
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'User-Agent': 'Fortnite/++Fortnite+Release-43.10-CL-60118918-Windows'
      }
    })

    if (!res.ok) return null

    const data = await res.json()
    const theatersMap: Record<string, { name: string; index: number }> = {}

    if (Array.isArray(data.theaters)) {
      data.theaters.forEach((th: any, idx: number) => {
        const id = th.uniqueId
        if (id) {
          theatersMap[id] = {
            name: th.displayName || `Zone ${idx + 1}`,
            index: idx
          }
        }
      })
    }

    const alertsList: MissionAlert[] = []
    if (Array.isArray(data.missionAlerts)) {
      for (const alertGroup of data.missionAlerts) {
        const zoneInfo = theatersMap[alertGroup.theaterId] || { name: 'Save The World', index: 0 }
        for (const item of alertGroup.availableMissionAlerts || []) {
          const rawRewards = item?.missionAlertRewards?.items || []
          const rewards: MissionReward[] = rawRewards.map((r: any) => {
            const itemType = (r.itemType || '').toLowerCase()
            const isVBucks = itemType.includes('mtx') || itemType.includes('vbucks')
            const qty = r.quantity || 1
            const displayName = isVBucks
              ? `${qty} V-Bucks`
              : (r.itemType || '').split(':').pop()?.replace(/_/g, ' ') || 'Reward'
            return {
              templateId: r.itemType,
              quantity: qty,
              isVBucks,
              displayName
            }
          })

          alertsList.push({
            id: item.missionAlertGuid || item.name || String(Math.random()),
            zone: zoneInfo.name,
            zoneIndex: zoneInfo.index,
            powerLevel: item.tileIndex || 50,
            missionName: (item.categoryName || item.name || 'Mission Alert').replace(/_/g, ' '),
            missionType: item.categoryName?.includes('Storm') ? 'Mutant Storm' : 'Alert Mission',
            rewards,
            expiresAt: item.availableUntil || new Date(Date.now() + 12 * 3600000).toISOString()
          })
        }
      }
    }

    return alertsList.length > 0 ? alertsList : null
  } catch (err) {
    console.warn('Error fetching alerts from Epic Games', err)
    return null
  }
}

export async function fetchMissionAlerts(accessToken?: string): Promise<MissionAlert[]> {
  // 1. Primary: Extract live mission alerts from stw.news
  const stwNewsAlerts = await fetchFromStwNews()
  if (stwNewsAlerts && stwNewsAlerts.length > 0) {
    return stwNewsAlerts
  }

  // 2. Secondary: If logged in, fetch from Epic Games authenticated endpoint
  if (accessToken) {
    const epicAlerts = await fetchFromEpicGames(accessToken)
    if (epicAlerts && epicAlerts.length > 0) {
      return epicAlerts
    }
  }

  // 3. No live alerts available
  return []
}
