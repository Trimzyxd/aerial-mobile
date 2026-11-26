import React, { useState, useMemo, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  TextInput,
  ActivityIndicator
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AutoRerollConfig } from '../types'
import { STW_DAILY_QUESTS_CATALOG } from '../api/daily-quests'

interface BlacklistModalProps {
  visible: boolean
  config: AutoRerollConfig
  onClose: () => void
  onSave: (config: AutoRerollConfig) => void
  onRunNow: () => void
  isRunning: boolean
}

type QuestCategory = 'All' | 'Destroy' | 'Scouting' | 'Husks & Weapons' | 'Mission Specialist' | 'Miscellaneous'

const CATEGORIES: QuestCategory[] = [
  'All',
  'Destroy',
  'Scouting',
  'Husks & Weapons',
  'Mission Specialist',
  'Miscellaneous'
]

export const BlacklistModal: React.FC<BlacklistModalProps> = ({
  visible,
  config,
  onClose,
  onSave,
  onRunNow,
  isRunning
}) => {
  const [enabled, setEnabled] = useState(config.enabled)
  const [rerollLowVBucks, setRerollLowVBucks] = useState(config.rerollLowVBucks)
  const [blacklistedTemplates, setBlacklistedTemplates] = useState<string[]>(
    config.blacklistedTemplates || []
  )
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory>('All')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [showKeywordsSection, setShowKeywordsSection] = useState<boolean>(false)
  const [keywords, setKeywords] = useState<string[]>(config.blacklistedKeywords || [])
  const [customKeywordInput, setCustomKeywordInput] = useState<string>('')

  useEffect(() => {
    if (visible) {
      setEnabled(config.enabled)
      setRerollLowVBucks(config.rerollLowVBucks)
      setBlacklistedTemplates(config.blacklistedTemplates || [])
      setKeywords(config.blacklistedKeywords || [])
    }
  }, [visible, config])

  const filteredQuests = useMemo(() => {
    return STW_DAILY_QUESTS_CATALOG.filter((q) => {
      if (selectedCategory !== 'All' && q.category !== selectedCategory) {
        return false
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        return q.name.toLowerCase().includes(query) || q.templateId.toLowerCase().includes(query)
      }
      return true
    })
  }, [selectedCategory, searchQuery])

  const toggleQuest = (templateId: string) => {
    const isSelected = blacklistedTemplates.includes(templateId)
    if (isSelected) {
      setBlacklistedTemplates(blacklistedTemplates.filter((t) => t !== templateId))
    } else {
      setBlacklistedTemplates([...blacklistedTemplates, templateId])
    }
  }

  const handleSelectAllCategory = () => {
    const idsToSelect = filteredQuests.map((q) => q.templateId)
    const combined = Array.from(new Set([...blacklistedTemplates, ...idsToSelect]))
    setBlacklistedTemplates(combined)
  }

  const handleDeselectAllCategory = () => {
    const idsToRemove = new Set(filteredQuests.map((q) => q.templateId))
    setBlacklistedTemplates(blacklistedTemplates.filter((id) => !idsToRemove.has(id)))
  }

  const handleAddKeyword = () => {
    const trimmed = customKeywordInput.trim().toLowerCase()
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords([...keywords, trimmed])
      setCustomKeywordInput('')
    }
  }

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  const handleSaveAndClose = () => {
    onSave({
      ...config,
      enabled,
      rerollLowVBucks,
      blacklistedTemplates,
      blacklistedKeywords: keywords
    })
    onClose()
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="filter-circle" size={24} color="#f59e0b" />
              <View>
                <Text style={styles.title}>Daily Quest Blacklist</Text>
                <Text style={styles.subTitle}>Select missions to automatically reroll</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Master Toggles */}
          <View style={styles.togglesCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Auto-Replace Enabled</Text>
                <Text style={styles.settingSub}>Automatically detect and replace blacklisted daily missions</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: '#334155', true: '#0284c7' }}
                thumbColor={enabled ? '#38bdf8' : '#64748b'}
              />
            </View>

            <View style={[styles.settingRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Reroll All 100 V-Bucks Quests</Text>
                <Text style={styles.settingSub}>Auto-replace standard 100 VB missions to aim for 150 VB</Text>
              </View>
              <Switch
                value={rerollLowVBucks}
                onValueChange={setRerollLowVBucks}
                trackColor={{ false: '#334155', true: '#d97706' }}
                thumbColor={rerollLowVBucks ? '#f59e0b' : '#64748b'}
              />
            </View>
          </View>

          {/* Category Filter Pills & Quick Search */}
          <View style={styles.filterSection}>
            <View style={styles.modalSearchRow}>
              <Ionicons name="search" size={14} color="#64748b" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Filter list (optional)..."
                placeholderTextColor="#64748b"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={15} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
              {CATEGORIES.map((cat) => {
                const isCatActive = selectedCategory === cat
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isCatActive ? styles.categoryChipActive : null]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, isCatActive ? styles.categoryChipTextActive : null]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            {/* Quest Selection Actions Header */}
            <View style={styles.selectionBar}>
              <View style={styles.selectionCounter}>
                <Ionicons name="checkbox" size={16} color="#38bdf8" />
                <Text style={styles.counterText}>
                  {blacklistedTemplates.length} of {STW_DAILY_QUESTS_CATALOG.length} Blacklisted
                </Text>
              </View>
              <View style={styles.batchActionRow}>
                <TouchableOpacity style={styles.batchBtn} onPress={handleSelectAllCategory}>
                  <Text style={styles.batchBtnText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.batchBtn} onPress={handleDeselectAllCategory}>
                  <Text style={styles.batchBtnText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Quest Checklist */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 16 }}>
            {filteredQuests.map((quest) => {
              const isSelected = blacklistedTemplates.includes(quest.templateId)
              return (
                <TouchableOpacity
                  key={quest.templateId}
                  style={[styles.questRow, isSelected ? styles.questRowSelected : null]}
                  onPress={() => toggleQuest(quest.templateId)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, isSelected ? styles.checkboxSelected : null]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                  </View>

                  <View style={styles.questInfo}>
                    <Text style={[styles.questName, isSelected ? styles.questNameSelected : null]}>
                      {quest.name}
                    </Text>
                    <View style={styles.questMetaRow}>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{quest.category}</Text>
                      </View>
                      <Text style={styles.targetText}>Target: {quest.target}</Text>
                    </View>
                  </View>

                  <View style={styles.vbucksBadge}>
                    <Ionicons name="sparkles" size={11} color="#f59e0b" />
                    <Text style={styles.vbucksBadgeText}>{quest.vbucks} VB</Text>
                  </View>
                </TouchableOpacity>
              )
            })}

            {/* Optional Custom Keyword Filter Section */}
            <TouchableOpacity
              style={styles.expandKeywordsHeader}
              onPress={() => setShowKeywordsSection(!showKeywordsSection)}
            >
              <Text style={styles.expandKeywordsText}>
                {showKeywordsSection ? '▼ Hide' : '▶ Show'} Advanced Keyword Filters ({keywords.length})
              </Text>
            </TouchableOpacity>

            {showKeywordsSection && (
              <View style={styles.keywordsCard}>
                <Text style={styles.keywordsDesc}>
                  Optional fallback: Quests matching any custom keyword will also be rerolled.
                </Text>

                <View style={styles.keywordInputRow}>
                  <TextInput
                    style={styles.keywordInput}
                    placeholder="Add custom keyword (e.g. traps)..."
                    placeholderTextColor="#64748b"
                    value={customKeywordInput}
                    onChangeText={setCustomKeywordInput}
                    autoCapitalize="none"
                    onSubmitEditing={handleAddKeyword}
                  />
                  <TouchableOpacity style={styles.addKeywordBtn} onPress={handleAddKeyword}>
                    <Text style={styles.addKeywordBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.keywordChipsWrap}>
                  {keywords.map((kw) => (
                    <View key={kw} style={styles.keywordChip}>
                      <Text style={styles.keywordChipText}>{kw}</Text>
                      <TouchableOpacity onPress={() => handleRemoveKeyword(kw)}>
                        <Ionicons name="close" size={13} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.runNowBtn, isRunning ? styles.btnDisabled : null]}
              onPress={onRunNow}
              disabled={isRunning}
            >
              {isRunning ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="flash" size={16} color="#ffffff" />
                  <Text style={styles.runNowBtnText}>Run Auto-Replace</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveAndClose}>
              <Text style={styles.saveBtnText}>Save Blacklist</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: '#0f141e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingTop: 16,
    borderWidth: 1,
    borderColor: '#26344d'
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1d273a'
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#f8fafc'
  },
  subTitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 1
  },
  togglesCard: {
    backgroundColor: '#161e2e',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#24324a'
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#202d42'
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 10
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f8fafc'
  },
  settingSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2
  },
  filterSection: {
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1d273a',
    paddingBottom: 10
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141b28',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#24324a',
    gap: 8
  },
  modalSearchInput: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 12,
    paddingVertical: 7
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8
  },
  categoryChip: {
    backgroundColor: '#161e2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#25344d'
  },
  categoryChipActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8'
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10
  },
  selectionCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  counterText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },
  batchActionRow: {
    flexDirection: 'row',
    gap: 8
  },
  batchBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  batchBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600'
  },
  scrollArea: {
    paddingHorizontal: 16,
    marginTop: 8
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141b28',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8,
    gap: 12
  },
  questRowSelected: {
    backgroundColor: '#1a2234',
    borderColor: '#e11d48'
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a'
  },
  checkboxSelected: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444'
  },
  questInfo: {
    flex: 1
  },
  questName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0'
  },
  questNameSelected: {
    color: '#fca5a5'
  },
  questMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3
  },
  categoryBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  categoryBadgeText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600'
  },
  targetText: {
    color: '#64748b',
    fontSize: 11
  },
  vbucksBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b2204',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b45309',
    gap: 4
  },
  vbucksBadgeText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '800'
  },
  expandKeywordsHeader: {
    paddingVertical: 12,
    alignItems: 'center'
  },
  expandKeywordsText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600'
  },
  keywordsCard: {
    backgroundColor: '#161e2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#24324a'
  },
  keywordsDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 8
  },
  keywordInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  keywordInput: {
    flex: 1,
    backgroundColor: '#0f1420',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#26344d',
    color: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12
  },
  addKeywordBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 6
  },
  addKeywordBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  keywordChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  keywordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6
  },
  keywordChipText: {
    color: '#cbd5e1',
    fontSize: 11
  },
  footerRow: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1d273a',
    gap: 12,
    backgroundColor: '#0d111a'
  },
  runNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6
  },
  runNowBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 10
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  btnDisabled: {
    opacity: 0.6
  }
})
