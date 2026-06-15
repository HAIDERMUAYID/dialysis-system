type Listener = () => void;

let online = typeof navigator !== 'undefined' ? navigator.onLine : true;
let servingCache = false;
let pendingEnrollCount = 0;
const listeners = new Set<Listener>();

function buildSnapshot() {
  return { online, servingCache, pendingEnrollCount };
}

/** مرجع ثابت يتغيّر فقط عند emit — مطلوب لـ useSyncExternalStore */
let snapshot = buildSnapshot();

function emit() {
  snapshot = buildSnapshot();
  listeners.forEach((fn) => fn());
}

export function getDialysisOfflineState() {
  return snapshot;
}

export function subscribeDialysisOfflineState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setDialysisServingCache(value: boolean) {
  if (servingCache === value) return;
  servingCache = value;
  emit();
}

export function setDialysisPendingEnrollCount(count: number) {
  if (pendingEnrollCount === count) return;
  pendingEnrollCount = count;
  emit();
}

export function initDialysisOfflineListeners() {
  if (typeof window === 'undefined') return () => undefined;
  const onOnline = () => {
    if (online && !servingCache) return;
    online = true;
    servingCache = false;
    emit();
  };
  const onOffline = () => {
    if (!online) return;
    online = false;
    emit();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

export function isNetworkError(err: unknown): boolean {
  if (!navigator.onLine) return true;
  const ax = err as { response?: unknown; code?: string; message?: string };
  if (ax.response) return false;
  const code = ax.code || '';
  const msg = (ax.message || '').toLowerCase();
  return code === 'ERR_NETWORK' || msg.includes('network error') || msg.includes('failed to fetch');
}
