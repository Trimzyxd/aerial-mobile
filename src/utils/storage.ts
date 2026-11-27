import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

const memoryStore: Record<string, string> = {}
// Android SecureStore enforces a 2048-byte limit per key; 1400 chars stays safely under even with UTF-8 multi-byte names.
const CHUNK_SIZE = 1400
const CHUNK_PREFIX = '__CHUNKED__:'

async function deleteTrailingChunks(key: string, startIndex: number): Promise<void> {
  let idx = startIndex
  while (true) {
    const chunkKey = `${key}_chk_${idx}`
    const existing = await SecureStore.getItemAsync(chunkKey)
    if (existing !== null) {
      await SecureStore.deleteItemAsync(chunkKey)
      idx++
    } else {
      break
    }
  }
}

export async function saveSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value)
    } else {
      memoryStore[key] = value
    }
    return
  }

  // Always cache in memory too so an active session never loses recent writes
  memoryStore[key] = value

  try {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value)
      await deleteTrailingChunks(key, 0)
    } else {
      const numChunks = Math.ceil(value.length / CHUNK_SIZE)
      await Promise.all(
        Array.from({ length: numChunks }, (_, i) => {
          const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          return SecureStore.setItemAsync(`${key}_chk_${i}`, chunk)
        })
      )
      await SecureStore.setItemAsync(key, `${CHUNK_PREFIX}${numChunks}`)
      await deleteTrailingChunks(key, numChunks)
    }
  } catch (err) {
    console.warn(`SecureStore save failed for key "${key}"`, err)
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
    const raw = await SecureStore.getItemAsync(key)
    if (!raw) {
      return memoryStore[key] || null
    }

    if (raw.startsWith(CHUNK_PREFIX)) {
      const numChunks = parseInt(raw.replace(CHUNK_PREFIX, ''), 10)
      if (isNaN(numChunks) || numChunks <= 0) {
        return memoryStore[key] || null
      }

      const chunks = await Promise.all(
        Array.from({ length: numChunks }, (_, i) => SecureStore.getItemAsync(`${key}_chk_${i}`))
      )
      if (chunks.some((chunk) => chunk === null)) {
        return memoryStore[key] || null
      }
      return chunks.join('')
    }

    return raw
  } catch {
    return memoryStore[key] || null
  }
}

export async function deleteSecureItem(key: string): Promise<void> {
  delete memoryStore[key]

  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
    return
  }

  try {
    const raw = await SecureStore.getItemAsync(key)
    if (raw && raw.startsWith(CHUNK_PREFIX)) {
      const numChunks = parseInt(raw.replace(CHUNK_PREFIX, ''), 10)
      if (!isNaN(numChunks) && numChunks > 0) {
        await Promise.all(
          Array.from({ length: numChunks }, (_, i) => SecureStore.deleteItemAsync(`${key}_chk_${i}`))
        )
      }
    }
    await SecureStore.deleteItemAsync(key)
    await deleteTrailingChunks(key, 0)
  } catch {
    // Ignore cleanup errors
  }
}
