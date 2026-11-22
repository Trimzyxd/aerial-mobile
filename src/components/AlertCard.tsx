import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { MissionAlert } from '../types'

interface AlertCardProps {
  alert: MissionAlert
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert }) => {
  const vbucksReward = alert.rewards.find(r => r.isVBucks)

  return (
    <View style={[styles.card, vbucksReward ? styles.vbucksBorder : null]}>
      <View style={styles.topRow}>
        <View style={styles.zonePill}>
          <Text style={styles.zoneText}>{alert.zone} · PL {alert.powerLevel}</Text>
        </View>
        {vbucksReward && (
          <View style={styles.vbucksBadge}>
            <Ionicons name="sparkles" size={13} color="#f59e0b" />
            <Text style={styles.vbucksBadgeText}>{vbucksReward.displayName}</Text>
          </View>
        )}
      </View>

      <Text style={styles.missionName}>{alert.missionName}</Text>
      <Text style={styles.missionType}>{alert.missionType}</Text>

      <View style={styles.rewardsRow}>
        {alert.rewards.map((reward, idx) => (
          <View key={idx} style={[styles.rewardTag, reward.isVBucks ? styles.vbucksTag : null]}>
            <Text style={[styles.rewardText, reward.isVBucks ? styles.vbucksTagText : null]}>
              {reward.displayName || reward.templateId}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161b26',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#232b3d'
  },
  vbucksBorder: {
    borderColor: '#d97706',
    backgroundColor: '#1b1a20'
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  zonePill: {
    backgroundColor: '#20293a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  zoneText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  vbucksBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#451a03',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#b45309'
  },
  vbucksBadgeText: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4
  },
  missionName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2
  },
  missionType: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 10
  },
  rewardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  rewardTag: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  rewardText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '500'
  },
  vbucksTag: {
    backgroundColor: '#78350f'
  },
  vbucksTagText: {
    color: '#fef08a',
    fontWeight: '700'
  }
})
