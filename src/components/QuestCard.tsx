import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { DailyQuest } from '../types'

interface QuestCardProps {
  quest: DailyQuest
}

export const QuestCard: React.FC<QuestCardProps> = ({ quest }) => {
  const progressRatio = Math.min(1, quest.progress / (quest.target || 1))

  return (
    <View style={[styles.card, quest.isBlacklisted ? styles.cardBlacklisted : null]}>
      {quest.isBlacklisted && (
        <View style={styles.blacklistBanner}>
          <Ionicons name="alert-circle" size={13} color="#fca5a5" />
          <Text style={styles.blacklistBannerText}>
            Blacklist match: {quest.blacklistReason || 'Will be auto-replaced'}
          </Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <Text style={styles.title}>{quest.name}</Text>
        <View style={styles.vbucksBadge}>
          <Ionicons name="sparkles" size={12} color="#f59e0b" />
          <Text style={styles.vbucksText}>+{quest.vbucksReward} V-Bucks</Text>
        </View>
      </View>

      <Text style={styles.description}>{quest.description}</Text>

      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressRatio * 100}%` },
              quest.isBlacklisted ? styles.progressBarFillBlacklisted : null
            ]}
          />
        </View>
        <Text style={styles.progressText}>{quest.progress} / {quest.target}</Text>
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
  cardBlacklisted: {
    borderColor: '#991b1b',
    backgroundColor: '#1c1318'
  },
  blacklistBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#450a0a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
    gap: 4
  },
  blacklistBannerText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '700'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  title: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    marginRight: 8
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
  vbucksText: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4
  },
  description: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#0f172a',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 10
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 4
  },
  progressBarFillBlacklisted: {
    backgroundColor: '#ef4444'
  },
  progressText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right'
  }
})
