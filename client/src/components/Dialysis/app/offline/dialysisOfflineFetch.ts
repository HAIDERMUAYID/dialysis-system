import { offlineCacheGet, offlineCachePut } from './dialysisOfflineDb';
import { isNetworkError, setDialysisServingCache } from './dialysisOfflineState';

export class DialysisOfflineNoCacheError extends Error {
  constructor() {
    super('لا توجد بيانات محفوظة للقراءة بدون اتصال');
    this.name = 'DialysisOfflineNoCacheError';
  }
}

export async function fetchWithOfflineCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (navigator.onLine) {
    try {
      const data = await fetcher();
      await offlineCachePut(cacheKey, data);
      setDialysisServingCache(false);
      return data;
    } catch (err) {
      const cached = await offlineCacheGet<T>(cacheKey);
      if (cached && isNetworkError(err)) {
        setDialysisServingCache(true);
        return cached.data;
      }
      throw err;
    }
  }

  const cached = await offlineCacheGet<T>(cacheKey);
  if (cached) {
    setDialysisServingCache(true);
    return cached.data;
  }
  throw new DialysisOfflineNoCacheError();
}
