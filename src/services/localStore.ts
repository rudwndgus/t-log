import type { TLogData } from '../types'

const DB_NAME = 'tlog-local'
const STORE_NAME = 'app'
const DATA_KEY = 'data'

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadLocalData(fallback: TLogData): Promise<TLogData> {
  try {
    const database = await openDatabase()
    return await new Promise<TLogData>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(DATA_KEY)
      request.onsuccess = () => {
        if (request.result) { resolve(request.result as TLogData); return }
        try { resolve(JSON.parse(localStorage.getItem('tlog:data:v1') || '') as TLogData) } catch { resolve(fallback) }
      }
      request.onerror = () => reject(request.error)
    })
  } catch { return fallback }
}

export async function saveLocalData(data: TLogData) {
  try {
    const database = await openDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(data, DATA_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  } catch { /* Private browsing can reject IndexedDB writes. */ }
}
