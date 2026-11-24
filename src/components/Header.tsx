import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { EpicAccountSession, SavedAccount } from '../types'
import { calculateGrandTotalVBucks } from '../api/epic-auth'

interface HeaderProps {
  title: string
  session: EpicAccountSession | null
  accounts?: SavedAccount[]
  showGrandTotal?: boolean
  onOpenVault?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  title,
  session,
  accounts = [],
  showGrandTotal = false,
  onOpenVault
}) => {
  const grandTotal = calculateGrandTotalVBucks(accounts)
  const activeBalance = session?.vbucksBalance ?? 0
  const displayedVBucks = showGrandTotal && accounts.length > 0 ? grandTotal.total : (session ? activeBalance : 0)

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.brand}>AERIAL</Text>
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.rightCluster}>
        {/* V-Bucks Balance Pill */}
        {session ? (
          <TouchableOpacity
            style={[styles.vbucksPill, showGrandTotal ? styles.vbucksPillGrand : null]}
            onPress={onOpenVault}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={13} color="#f59e0b" />
            <Text style={styles.vbucksPillText}>
              {displayedVBucks.toLocaleString()} <Text style={styles.vbSmall}>VB</Text>
            </Text>
            {showGrandTotal && (
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>ALL</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}

        {/* Account Avatar Badge */}
        <TouchableOpacity style={styles.accountBadge} onPress={onOpenVault} activeOpacity={0.7}>
          <Ionicons name="person-circle-outline" size={18} color="#38bdf8" />
          <Text style={styles.accountName} numberOfLines={1}>
            {session ? session.displayName : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#0f1117',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2433'
  },
  brand: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#38bdf8'
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc'
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  vbucksPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#381a03',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#b45309',
    gap: 4
  },
  vbucksPillGrand: {
    backgroundColor: '#451a03',
    borderColor: '#f59e0b'
  },
  vbucksPillText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '800'
  },
  vbSmall: {
    fontSize: 10,
    color: '#fef08a'
  },
  totalBadge: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 2
  },
  totalBadgeText: {
    color: '#0d1017',
    fontSize: 8,
    fontWeight: '900'
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a2234',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#26334d',
    maxWidth: 120
  },
  accountName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#e2e8f0',
    marginLeft: 4
  }
})
