import { openDB, type IDBPDatabase } from 'idb'
import type { PersistStorage, StorageValue } from 'zustand/middleware'

const DB_NAME = 'cutlist-optimizer'
const DB_VERSION = 1
const STORE_NAME = 'kv'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('indexedDB unavailable'))
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

export function createIdbStorage<T>(): PersistStorage<T> {
  return {
    async getItem(name): Promise<StorageValue<T> | null> {
      try {
        const db = await getDb()
        const value = await db.get(STORE_NAME, name)
        return (value as StorageValue<T>) ?? null
      } catch {
        return null
      }
    },
    async setItem(name, value): Promise<void> {
      try {
        const db = await getDb()
        await db.put(STORE_NAME, value, name)
      } catch {
        // ignore quota or unavailable errors
      }
    },
    async removeItem(name): Promise<void> {
      try {
        const db = await getDb()
        await db.delete(STORE_NAME, name)
      } catch {
        // ignore
      }
    },
  }
}
