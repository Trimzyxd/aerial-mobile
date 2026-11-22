import { MissionAlert, MissionReward } from '../types'

const STW_NEWS_API = 'https://stw.news/api/v1/missions'

// STW Mission Alerts normalized to 50 V-Bucks across all zones
const MOCK_ALERTS: MissionAlert[] = [
  {
    id: 'mock-1',
    zone: 'Twine Peaks',
    zoneIndex: 4,
    powerLevel: 140,
    missionName: 'Retrieve the Data',
    missionType: 'Evacuate / Defense',
    rewards: [
      { templateId: 'Currency:MtxComplimentary', quantity: 50, isVBucks: true, displayName: '50 V-Bucks' },
      { templateId: 'AccountResource:reagent_c_t04', quantity: 120, displayName: 'Pure Drop of Rain' }
    ],
    expiresAt: new Date(Date.now() + 8 * 3600000).toISOString()
  },
  {
    id: 'mock-2',
    zone: 'Canny Valley',
    zoneIndex: 3,
    powerLevel: 70,
    missionName: 'Fight Category 3 Storm',
    missionType: 'Storm Defense',
    rewards: [
      { templateId: 'Currency:MtxComplimentary', quantity: 50, isVBucks: true, displayName: '50 V-Bucks' },
      { templateId: 'AccountResource:eventcurrency_spring', quantity: 100, displayName: 'Spring Tickets' }
    ],
    expiresAt: new Date(Date.now() + 8 * 3600000).toISOString()
  },
  {
    id: 'mock-3',
    zone: 'Plankerton',
    zoneIndex: 2,
    powerLevel: 46,
    missionName: 'Ride the Lightning',
    missionType: 'Van Defense',
    rewards: [
      { templateId: 'Currency:MtxComplimentary', quantity: 50, isVBucks: true, displayName: '50 V-Bucks' },
      { templateId: 'CardPack:zcp_herorecruit_sr', quantity: 1, displayName: 'Legendary Hero Key' }
    ],
    expiresAt: new Date(Date.now() + 8 * 3600000).toISOString()
  },
  {
    id: 'mock-4',
    zone: 'Stonewood',
    zoneIndex: 1,
    powerLevel: 19,
    missionName: 'Deliver the Bomb',
    missionType: 'Rift Destruction',
    rewards: [
      { templateId: 'Currency:MtxComplimentary', quantity: 50, isVBucks: true, displayName: '50 V-Bucks' },
      { templateId: 'AccountResource:reagent_c_t01', quantity: 30, displayName: 'Pure Drop of Rain' }
    ],
    expiresAt: new Date(Date.now() + 8 * 3600000).toISOString()
  }
]

export async function fetchMissionAlerts(): Promise<MissionAlert[]> {
  try {
    const res = await fetch(STW_NEWS_API, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AerialMobile/1.0.0'
      }
    })

    if (!res.ok) {
      console.warn(`stw.news returned status ${res.status}, using mock alerts`)
      return MOCK_ALERTS
    }

    const json = await res.json()
    const missions = json.missions || json.data || json

    if (!Array.isArray(missions)) {
      return MOCK_ALERTS
    }

    return missions.map((m: any, idx: number) => {
      const rewards: MissionReward[] = (m.rewards || []).map((r: any) => {
        const id = r.item || r.templateId || ''
        const isVBucks = id.toLowerCase().includes('mtx') || id.toLowerCase().includes('vbucks')
        const quantity = isVBucks ? 50 : (r.quantity || r.amount || 1)
        return {
          templateId: id,
          quantity,
          isVBucks,
          displayName: isVBucks ? '50 V-Bucks' : r.displayName || id
        }
      })

      return {
        id: m.id || `mission-${idx}`,
        zone: m.zone || m.theater || 'Twine Peaks',
        zoneIndex: m.zoneIndex || 0,
        powerLevel: m.powerLevel || m.pl || 100,
        missionName: m.name || m.missionName || 'Mission Alert',
        missionType: m.type || m.missionType || 'Standard',
        rewards,
        expiresAt: m.expiresAt || new Date(Date.now() + 12 * 3600000).toISOString()
      }
    })
  } catch (err) {
    console.warn('Network error fetching stw.news, using fallback alerts', err)
    return MOCK_ALERTS
  }
}
