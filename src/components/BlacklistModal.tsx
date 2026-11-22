import React, { useState } from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  ScrollView
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { AutoRerollConfig } from '../types'

interface BlacklistModalProps {
  visible: boolean
  config: AutoRerollConfig
  onClose: () => void
  onSave: (config: AutoRerollConfig) => void
  onRunNow: () => void
  isRunning: boolean
}

const PRESET_KEYWORDS = [
  'arcade',
  'outlander',
  'ninja',
  'explore',
  'play with others',
  'gnomes',
  'trap'
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
  const [keywords, setKeywords] = useState<string[]>(config.blacklistedKeywords)
  const [inputKeyword, setInputKeyword] = useState('')

  const handleAddKeyword = (kw?: string) => {
    const val = (kw || inputKeyword).trim().toLowerCase()
    if (val && !keywords.includes(val)) {
      setKeywords([...keywords, val])
      if (!kw) setInputKeyword('')
    }
  }

  const handleRemoveKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw))
  }

  const handleSaveAndClose = () => {
    onSave({
      ...config,
      enabled,
      rerollLowVBucks,
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
              <Text style={styles.title}>Auto-Replace Mission Blacklist</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollArea}>
            {/* Master Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Auto-Replace Active</Text>
                <Text style={styles.settingSub}>Automatically detect and reroll blacklisted quests</Text>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: '#334155', true: '#0284c7' }}
                thumbColor={enabled ? '#38bdf8' : '#64748b'}
              />
            </View>

            {/* Low V-Bucks Toggle */}
            <View style={styles.settingRow}>
              <View style={styles.settingTextCol}>
                <Text style={styles.settingLabel}>Reroll 50 V-Bucks Quests</Text>
                <Text style={styles.settingSub}>Auto-replace lowest yield to aim for 60/100 V-Bucks</Text>
              </View>
              <Switch
                value={rerollLowVBucks}
                onValueChange={setRerollLowVBucks}
                trackColor={{ false: '#334155', true: '#d97706' }}
                thumbColor={rerollLowVBucks ? '#f59e0b' : '#64748b'}
              />
            </View>

            {/* Keyword Input */}
            <Text style={styles.sectionHeader}>Blacklisted Keywords</Text>
            <Text style={styles.sectionSub}>Quests matching these names or descriptions will be rerolled:</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="e.g. arcade, ninja, explore..."
                placeholderTextColor="#64748b"
                value={inputKeyword}
                onChangeText={setInputKeyword}
                onSubmitEditing={() => handleAddKeyword()}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.addButton} onPress={() => handleAddKeyword()}>
                <Ionicons name="add" size={18} color="#0d1017" />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Active Keywords */}
            <View style={styles.chipsContainer}>
              {keywords.map((kw) => (
                <View key={kw} style={styles.keywordChip}>
                  <Text style={styles.keywordText}>{kw}</Text>
                  <TouchableOpacity onPress={() => handleRemoveKeyword(kw)}>
                    <Ionicons name="close-circle" size={16} color="#fca5a5" />
                  </TouchableOpacity>
                </View>
              ))}
              {keywords.length === 0 && (
                <Text style={styles.emptyKeywords}>No keywords added yet.</Text>
              )}
            </View>

            {/* Presets */}
            <Text style={styles.presetHeader}>Quick Add Presets:</Text>
            <View style={styles.presetRow}>
              {PRESET_KEYWORDS.map((preset) => {
                const added = keywords.includes(preset)
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetChip, added ? styles.presetChipDisabled : null]}
                    onPress={() => handleAddKeyword(preset)}
                    disabled={added}
                  >
                    <Text style={[styles.presetText, added ? styles.presetTextDisabled : null]}>
                      {added ? `✓ ${preset}` : `+ ${preset}`}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.runNowBtn, isRunning ? styles.runNowBtnDisabled : null]}
              onPress={onRunNow}
              disabled={isRunning}
            >
              <Ionicons name="flash" size={16} color="#0d1017" />
              <Text style={styles.runNowText}>{isRunning ? 'Rerolling...' : 'Run Auto-Replace Now'}</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#121722',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#26334a'
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
    marginBottom: 16
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1d273a'
  },
  settingTextCol: {
    flex: 1,
    paddingRight: 14
  },
  settingLabel: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '600'
  },
  settingSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2
  },
  sectionHeader: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 16
  },
  sectionSub: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 8,
    marginTop: 2
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10
  },
  input: {
    flex: 1,
    backgroundColor: '#192233',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e3d56',
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13
  },
  addButton: {
    backgroundColor: '#38bdf8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 2
  },
  addButtonText: {
    color: '#0d1017',
    fontSize: 12,
    fontWeight: '700'
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    minHeight: 32,
    marginBottom: 14
  },
  keywordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b1c1c',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 6
  },
  keywordText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '600'
  },
  emptyKeywords: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 4
  },
  presetHeader: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8
  },
  presetChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  presetChipDisabled: {
    opacity: 0.4
  },
  presetText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '500'
  },
  presetTextDisabled: {
    color: '#64748b'
  },
  footer: {
    flexDirection: 'row',
    gap: 10
  },
  runNowBtn: {
    flex: 1,
    backgroundColor: '#f59e0b',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6
  },
  runNowBtnDisabled: {
    opacity: 0.6
  },
  runNowText: {
    color: '#0d1017',
    fontSize: 13,
    fontWeight: '800'
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  }
})
