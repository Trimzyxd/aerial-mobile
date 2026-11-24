import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SavedAccount } from '../types'
import { calculateGrandTotalVBucks } from '../api/epic-auth'

interface VBucksVaultModalProps {
  visible: boolean
  accounts: SavedAccount[]
  onClose: () => void
  onSwitchAccount: (accountId: string) => void
  onRemoveAccount: (accountId: string) => void
  onAddAccountPress: () => void
  showGrandTotalInHeader: boolean
  onToggleHeaderTotal: (val: boolean) => void
}

export const VBucksVaultModal: React.FC<VBucksVaultModalProps> = ({
  visible,
  accounts,
  onClose,
  onSwitchAccount,
  onRemoveAccount,
  onAddAccountPress,
  showGrandTotalInHeader,
  onToggleHeaderTotal
}) => {
  const grandTotal = calculateGrandTotalVBucks(accounts)

  const confirmRemove = (acc: SavedAccount) => {
    Alert.alert(
      'Remove Account',
      `Remove "${acc.displayName}" from saved accounts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onRemoveAccount(acc.accountId)
        }
      ]
    )
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="wallet" size={22} color="#f59e0b" />
              <Text style={styles.title}>V-Bucks Vault & Accounts</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea}>
            {/* Grand Total Card */}
            <View style={styles.grandTotalCard}>
              <View style={styles.grandTotalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="sparkles" size={16} color="#fbbf24" />
                  <Text style={styles.grandTotalLabel}>Total Across All Accounts</Text>
                </View>
                <View style={styles.accountCountBadge}>
                  <Text style={styles.accountCountText}>{accounts.length} Accounts</Text>
                </View>
              </View>

              <Text style={styles.grandTotalValue}>
                {grandTotal.total.toLocaleString()} <Text style={styles.vbUnit}>V-Bucks</Text>
              </Text>

              <View style={styles.breakdownRow}>
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownSub}>Earned (STW / BP)</Text>
                  <Text style={styles.breakdownVal}>+{grandTotal.complimentary.toLocaleString()}</Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownSub}>Purchased</Text>
                  <Text style={styles.breakdownVal}>+{grandTotal.purchased.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Header Display Preference Switch */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.toggleLabel}>Display Grand Total in Top Header</Text>
                <Text style={styles.toggleSub}>Shows combined V-Bucks sum across all accounts in the top bar</Text>
              </View>
              <Switch
                value={showGrandTotalInHeader}
                onValueChange={onToggleHeaderTotal}
                trackColor={{ false: '#334155', true: '#d97706' }}
                thumbColor={showGrandTotalInHeader ? '#fbbf24' : '#64748b'}
              />
            </View>

            {/* Accounts List */}
            <Text style={styles.sectionTitle}>Logged In Accounts ({accounts.length})</Text>

            {accounts.length === 0 ? (
              <View style={styles.emptyAccountBox}>
                <Ionicons name="person-outline" size={32} color="#64748b" />
                <Text style={styles.emptyAccountText}>No accounts connected yet.</Text>
                <Text style={styles.emptyAccountSub}>Tap below to connect your Epic Games account.</Text>
              </View>
            ) : (
              accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.accountId}
                  style={[styles.accountCard, acc.isActive ? styles.accountCardActive : null]}
                  onPress={() => !acc.isActive && onSwitchAccount(acc.accountId)}
                  activeOpacity={0.7}
                >
                  <View style={styles.accountTopRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.accountName}>{acc.displayName}</Text>
                        {acc.isActive ? (
                          <View style={styles.activePill}>
                            <Text style={styles.activePillText}>ACTIVE</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.accountSubId}>ID: {acc.accountId}</Text>
                    </View>

                    <View style={styles.accountVbucksRight}>
                      <Text style={styles.accountVbucksText}>
                        {(acc.vbucks?.total || 0).toLocaleString()} <Text style={styles.vbUnitSmall}>VB</Text>
                      </Text>
                      <Text style={styles.accountVbucksSub}>
                        Earned: {(acc.vbucks?.complimentary || 0).toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accountActionsRow}>
                    <View style={styles.currentActiveLabel}>
                      {acc.isActive ? (
                        <>
                          <Ionicons name="checkmark-circle" size={15} color="#22c55e" />
                          <Text style={styles.currentActiveText}>Currently Selected</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="radio-button-off" size={14} color="#64748b" />
                          <Text style={{ color: '#94a3b8', fontSize: 11 }}>Tap to switch</Text>
                        </>
                      )}
                    </View>

                    {accounts.length > 1 && (
                      <TouchableOpacity
                        style={styles.trashBtn}
                        onPress={(e) => {
                          e.stopPropagation()
                          confirmRemove(acc)
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="trash-outline" size={15} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}

            {/* Add Account Button */}
            <TouchableOpacity
              style={styles.addAccountBtn}
              onPress={() => {
                onClose()
                onAddAccountPress()
              }}
            >
              <Ionicons name="person-add" size={16} color="#38bdf8" />
              <Text style={styles.addAccountBtnText}>+ Connect Another Epic Account</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#111622',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#222f46'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  title: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700'
  },
  scrollArea: {
    marginBottom: 10
  },
  grandTotalCard: {
    backgroundColor: '#261904',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#b45309',
    marginBottom: 14
  },
  grandTotalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  grandTotalLabel: {
    color: '#fef3c7',
    fontSize: 12,
    fontWeight: '700'
  },
  accountCountBadge: {
    backgroundColor: '#451a03',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#78350f'
  },
  accountCountText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '700'
  },
  grandTotalValue: {
    color: '#fbbf24',
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 12
  },
  vbUnit: {
    fontSize: 16,
    color: '#fde68a',
    fontWeight: '700'
  },
  breakdownRow: {
    flexDirection: 'row',
    backgroundColor: '#1b1202',
    borderRadius: 8,
    padding: 10
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'center'
  },
  breakdownSub: {
    color: '#d4af37',
    fontSize: 10,
    marginBottom: 2
  },
  breakdownVal: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  breakdownDivider: {
    width: 1,
    backgroundColor: '#523407',
    height: '80%',
    alignSelf: 'center'
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172030',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#24324a',
    marginBottom: 16
  },
  toggleLabel: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600'
  },
  toggleSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10
  },
  accountCard: {
    backgroundColor: '#161d2a',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#253046',
    marginBottom: 10
  },
  accountCardActive: {
    borderColor: '#0284c7',
    backgroundColor: '#122033'
  },
  accountTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  accountName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  activePill: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  activePillText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800'
  },
  accountSubId: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  accountVbucksRight: {
    alignItems: 'flex-end'
  },
  accountVbucksText: {
    color: '#fbbf24',
    fontSize: 16,
    fontWeight: '800'
  },
  vbUnitSmall: {
    fontSize: 11,
    color: '#fef08a'
  },
  accountVbucksSub: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1
  },
  accountActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#202a3d',
    paddingTop: 8
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f2942',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4
  },
  switchBtnText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700'
  },
  currentActiveLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  currentActiveText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '600'
  },
  trashBtn: {
    padding: 4
  },
  addAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#172439',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0284c7',
    marginTop: 6,
    gap: 6
  },
  addAccountBtnText: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700'
  },
  emptyAccountBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#121722',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1d2638',
    marginBottom: 12
  },
  emptyAccountText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8
  },
  emptyAccountSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4
  }
})
