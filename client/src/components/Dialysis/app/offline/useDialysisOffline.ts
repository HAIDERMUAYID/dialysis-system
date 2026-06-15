import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getDialysisOfflineState,
  initDialysisOfflineListeners,
  subscribeDialysisOfflineState,
} from './dialysisOfflineState';
import { flushDialysisFaceEnrollQueue, refreshEnrollQueueCount } from './dialysisFaceEnrollQueue';

export function useDialysisOffline() {
  const state = useSyncExternalStore(
    subscribeDialysisOfflineState,
    getDialysisOfflineState,
    getDialysisOfflineState
  );
  const [flushing, setFlushing] = useState(false);

  useEffect(() => {
    const cleanup = initDialysisOfflineListeners();
    void refreshEnrollQueueCount();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!state.online) return;
    setFlushing(true);
    void flushDialysisFaceEnrollQueue()
      .then((r) => {
        if (r.synced > 0) {
          window.dispatchEvent(
            new CustomEvent('dialysis-offline-enroll-synced', { detail: { count: r.synced } })
          );
        }
      })
      .finally(() => setFlushing(false));
  }, [state.online]);

  return { ...state, flushing };
}
