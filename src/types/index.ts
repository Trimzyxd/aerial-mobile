export interface MissionReward {
  templateId: string
  quantity: number
  isVBucks?: boolean
  displayName?: string
  iconUrl?: string
}

export interface MissionAlert {
  id: string
  zone: string
  zoneIndex: number
  powerLevel: number
  missionName: string
  missionType: string
  tierName?: string
  rewards: MissionReward[]
  expiresAt: string
}

export interface DailyQuest {
  id: string
  templateId: string
  name: string
  description: string
  progress: number
  target: number
  vbucksReward: number
  canReroll: boolean
  isBlacklisted?: boolean
  blacklistReason?: string
}

export interface AutoRerollConfig {
  enabled: boolean
  rerollLowVBucks: boolean
  blacklistedKeywords: string[]
  blacklistedTemplates: string[]
}

export interface AutoRerollSummary {
  success: boolean
  rerolledCount: number
  details: Array<{
    accountName?: string
    questName: string
    reason: string
    success: boolean
    message?: string
  }>
}

export interface AccountDailyQuestsGroup {
  accountId: string
  displayName: string
  quests: DailyQuest[]
  rerollsRemaining: number
  error?: string
  needsRelogin?: boolean
}

export interface Friend {
  accountId: string
  displayName: string
  status: 'ONLINE' | 'OFFLINE' | 'AWAY'
  lastSeen?: string
  created?: string
  isEligible48h?: boolean
  hoursRemaining?: number
}

export interface FriendRequest {
  accountId: string
  displayName: string
  direction: 'INCOMING' | 'OUTGOING'
  created: string
}

export interface GrantedItem {
  id: string
  name: string
  description?: string
  type: string
  rarity?: string
  image?: string
}

export interface ShopItem {
  id: string
  name: string
  description: string
  price: number
  regularPrice: number
  rarity: string
  category: string
  isBundle?: boolean
  banner?: string
  images: {
    icon?: string
    featured?: string
  }
  grantedItems?: GrantedItem[]
  giftable: boolean
  expires: string
}

export interface GiftBoxTemplate {
  id: string
  name: string
  previewColor: string
}

export interface VBucksDetail {
  total: number
  complimentary: number // Earned (STW / BP)
  purchased: number     // Real money purchase
}

export interface SavedAccount {
  accountId: string
  displayName: string
  accessToken: string
  expiresAt: string
  deviceId?: string
  secret?: string
  vbucks: VBucksDetail
  isActive: boolean
}

export interface EpicAccountSession {
  accountId: string
  displayName: string
  accessToken: string
  expiresAt: string
  deviceId?: string
  secret?: string
  vbucksBalance?: number
  vbucksDetail?: VBucksDetail
}
