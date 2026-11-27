import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Friend, FriendRequest } from '../types'

interface FriendItemProps {
  friend?: Friend
  request?: FriendRequest
  onAccept?: (accountId: string) => void
  onAcceptAll?: (accountId: string) => void
  onReject?: (accountId: string) => void
  onRemove?: (accountId: string) => void
}

export const FriendItem: React.FC<FriendItemProps> = ({
  friend,
  request,
  onAccept,
  onAcceptAll,
  onReject,
  onRemove
}) => {
  if (friend) {
    const isGiftReady = friend.isEligible48h !== false

    return (
      <View style={styles.container}>
        <View style={styles.leftCol}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color="#94a3b8" />
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.displayName}>{friend.displayName}</Text>
            <Text style={[styles.statusText, !isGiftReady && { color: '#fbbf24' }]}>
              {isGiftReady
                ? 'Gift Eligible (48h+)'
                : `Gift ready in ${friend.hoursRemaining || 48}h`}
            </Text>
          </View>
        </View>

        {onRemove && (
          <TouchableOpacity
            style={styles.actionBtnSecondary}
            onPress={() => onRemove(friend.accountId)}
          >
            <Ionicons name="person-remove-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>
    )
  }

  if (request) {
    const isIncoming = request.direction === 'INCOMING'

    return (
      <View style={styles.container}>
        <View style={styles.leftCol}>
          <View style={styles.avatar}>
            <Ionicons name={isIncoming ? "arrow-down" : "arrow-up"} size={16} color="#38bdf8" />
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.displayName}>{request.displayName}</Text>
            <Text style={styles.statusText}>{isIncoming ? 'Incoming Request' : 'Outgoing Pending'}</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          {isIncoming && onAccept && (
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => onAccept(request.accountId)}
            >
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
          )}

          {isIncoming && onAcceptAll && (
            <TouchableOpacity
              style={styles.acceptAllBtn}
              onPress={() => onAcceptAll(request.accountId)}
            >
              <Ionicons name="people" size={11} color="#ffffff" style={{ marginRight: 3 }} />
              <Text style={styles.acceptAllBtnText}>All</Text>
            </TouchableOpacity>
          )}

          {onReject && (
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={() => onReject(request.accountId)}
            >
              <Text style={styles.rejectBtnText}>{isIncoming ? 'Decline' : 'Cancel'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  return null
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#161b26',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#202738'
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e2638',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: 10
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderWidth: 2,
    borderColor: '#161b26'
  },
  onlineDot: { backgroundColor: '#22c55e' },
  awayDot: { backgroundColor: '#eab308' },
  offlineDot: { backgroundColor: '#64748b' },
  nameBlock: {
    flex: 1
  },
  displayName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600'
  },
  statusText: {
    color: '#64748b',
    fontSize: 11
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8
  },
  acceptBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600'
  },
  acceptAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7c3aed',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  acceptAllBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  rejectBtn: {
    backgroundColor: '#272f42',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6
  },
  rejectBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  actionBtnSecondary: {
    padding: 6
  }
})
