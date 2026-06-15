const DB_NAME = 'd-irs-offline-v1';
const DB_VERSION = 1;
const CACHE_STORE = 'api_cache';
const QUEUE_STORE = 'enroll_queue';

export interface OfflineCacheEntry<T> {
  data: T;
  savedAt: string;
}

export interface QueuedFaceEnroll {
  id: string;
  patientId: number;
  hospitalId: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

export async function offlineCacheGet<T>(key: string): Promise<OfflineCacheEntry<T> | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readonly');
      const req = tx.objectStore(CACHE_STORE).get(key);
      req.onsuccess = () => resolve((req.result as OfflineCacheEntry<T>) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function offlineCachePut<T>(key: string, data: T): Promise<void> {
  try {
    const db = await openDb();
    const entry: OfflineCacheEntry<T> = { data, savedAt: new Date().toISOString() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, 'readwrite');
      tx.objectStore(CACHE_STORE).put(entry, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* non-critical */
  }
}

export async function enrollQueueAdd(item: Omit<QueuedFaceEnroll, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDb();
  const row: QueuedFaceEnroll = {
    ...item,
    id: `enroll-${item.patientId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function enrollQueueList(): Promise<QueuedFaceEnroll[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = () => {
        const rows = (req.result as QueuedFaceEnroll[]) || [];
        rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        resolve(rows);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function enrollQueueRemove(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function buildOfflineCacheKey(parts: (string | number | undefined | null)[]): string {
  return parts.filter((p) => p != null && p !== '').join('|');
}
