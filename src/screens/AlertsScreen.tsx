import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Header } from '../components/Header'
import { AlertCard } from '../components/AlertCard'
import { fetchMissionAlerts } from '../api/stw-alerts'
import { MissionAlert, EpicAccountSession, SavedAccount } from '../types'

interface AlertsScreenProps {
  session: EpicAccountSession | null
  accounts?: SavedAccount[]
  showGrandTotal?: boolean
  onOpenVault?: () => void
}

export const AlertsScreen: React.FC<AlertsScreenProps> = ({
  session,
  accounts,
  showGrandTotal,
  onOpenVault
}) => {
  const [alerts, setAlerts] = useState<MissionAlert[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'VBUCKS' | 'TWINE' | 'CANNY' | 'PLANK' | 'STONE'>('VBUCKS')
  const [resetCountdown, setResetCountdown] = useState<string>('')

  const formatDailyReset = () => {
    const now = new Date()
    const nextUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0)
    const diffMs = Math.max(0, nextUtcMidnight - now.getTime())
    const hrs = Math.floor(diffMs / 3600000)
    const mins = Math.floor((diffMs % 3600000) / 60000)
    return `${hrs}h ${mins}m`
  }

  useEffect(() => {
    setResetCountdown(formatDailyReset())
    const interval = setInterval(() => setResetCountdown(formatDailyReset()), 60000)
    return () => clearInterval(interval)
  }, [])

  const loadAlerts = async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const result = await fetchMissionAlerts(session?.accessToken, session?.accountId)
      if (result.alerts.length > 0) {
        setAlerts(result.alerts)
        setAlertsError(null)
      } else {
        setAlertsError(result.error || null)
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [])

  useEffect(() => {
    if (session?.accessToken && alerts.length === 0 && !loading) {
      loadAlerts(true)
    }
  }, [session?.accountId, session?.accessToken])

  const filteredAlerts = useMemo(() => {
    return alerts
      .filter(a => {
        if (selectedFilter === 'VBUCKS') return a.rewards.some(r => r.isVBucks)
        if (selectedFilter === 'TWINE') return a.zone.toLowerCase().includes('twine')
        if (selectedFilter === 'CANNY') return a.zone.toLowerCase().includes('canny')
        if (selectedFilter === 'PLANK') return a.zone.toLowerCase().includes('plank')
        if (selectedFilter === 'STONE') return a.zone.toLowerCase().includes('stone')
        return true
      })
      .sort((a, b) => {
        const aVb = a.rewards.some(r => r.isVBucks) ? 1 : 0
        const bVb = b.rewards.some(r => r.isVBucks) ? 1 : 0
        if (aVb !== bVb) return bVb - aVb
        return b.powerLevel - a.powerLevel
      })
  }, [alerts, selectedFilter])

  const totalVbucks = useMemo(() => {
    let sum = 0
    for (const a of alerts) {
      for (const r of a.rewards) {
        if (r.isVBucks) sum += r.quantity
      }
    }
    return sum
  }, [alerts])

  return (
    <View style={styles.container}>
      <Header
        title="STW Alerts"
        session={session}
        accounts={accounts}
        showGrandTotal={showGrandTotal}
        onOpenVault={onOpenVault}
      />

      <View style={styles.bannerRow}>
        <View style={styles.vbucksSummary}>
          <Ionicons name="sparkles" size={16} color="#f59e0b" />
          <Text style={styles.vbucksSummaryText}>Today's V-Bucks Total: <Text style={styles.highlight}>{totalVbucks} V-Bucks</Text></Text>
        </View>
        {resetCountdown ? (
          <View style={styles.resetPill}>
            <Ionicons name="time-outline" size={12} color="#94a3b8" />
            <Text style={styles.resetPillText}>{resetCountdown}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.filterBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'VBUCKS' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('VBUCKS')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="sparkles"
              size={13}
              color={selectedFilter === 'VBUCKS' ? '#ffffff' : '#f59e0b'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.filterText, selectedFilter === 'VBUCKS' && styles.filterTextActive]}>
              V-Bucks Only
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'ALL' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('ALL')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, selectedFilter === 'ALL' && styles.filterTextActive]}>
              All ({alerts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'TWINE' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('TWINE')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, selectedFilter === 'TWINE' && styles.filterTextActive]}>
              Twine Peaks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'CANNY' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('CANNY')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, selectedFilter === 'CANNY' && styles.filterTextActive]}>
              Canny Valley
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'PLANK' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('PLANK')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, selectedFilter === 'PLANK' && styles.filterTextActive]}>
              Plankerton
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'STONE' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('STONE')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, selectedFilter === 'STONE' && styles.filterTextActive]}>
              Stonewood
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.loadingText}>Fetching missions from stw.news...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAlerts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <AlertCard alert={item} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true)
                loadAlerts()
              }}
              tintColor="#38bdf8"
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {alertsError || 'No mission alerts found for this filter.'}
              </Text>
              {alertsError && (
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => loadAlerts(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="refresh" size={14} color="#0d1017" />
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1017'
  },
  bannerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#161d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#202b3f'
  },
  resetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  resetPillText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600'
  },
  vbucksSummary: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  vbucksSummaryText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6
  },
  highlight: {
    color: '#f59e0b',
    fontWeight: '800'
  },
  filterBarWrapper: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2233'
  },
  filterScroll: {
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161d2d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#243048',
    marginRight: 8,
    minHeight: 38
  },
  filterChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  filterText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center'
  },
  filterTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  listContent: {
    padding: 16,
    paddingBottom: 24
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    color: '#64748b',
    marginTop: 10,
    fontSize: 13
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center'
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#38bdf8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  retryBtnText: {
    color: '#0d1017',
    fontSize: 12,
    fontWeight: '700'
  }
})
