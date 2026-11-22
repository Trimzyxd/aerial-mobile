import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const memoryStore: Record<string, string> = {}

export async function saveSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
    } else {
      memoryStore[key] = value
    }
    return
  }

  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    memoryStore[key] = value
  }
}

export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key)
    }
    return memoryStore[key] || null
  }

  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return memoryStore[key] || null
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
    delete memoryStore[key]
    return
  }

  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    delete memoryStore[key]
  }
}
