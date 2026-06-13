import { useEffect } from 'react';
import { useDialysisMobile } from '../app/useDialysisMobile';
import { useDialysisOverlayLock } from '../app/useDialysisOverlayLock';

/** يمنع إطفاء الشاشة أثناء مسح الوجه (PWA / موبايل) */
export function useDialysisWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return undefined;
    }

    type WakeLockHandle = {
      release: () => Promise<void>;
      addEventListener?: (type: string, fn: () => void) => void;
    };

    let lock: WakeLockHandle | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock: { request: (type: 'screen') => Promise<WakeLockHandle> };
        };
        lock = await nav.wakeLock.request('screen');
        lock.addEventListener?.('release', () => {
          if (!cancelled) void acquire();
        });
      } catch {
        /* بعض المتصفحات ترفض بدون تفاعل مباشر */
      }
    };

    void acquire();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}

/** تجربة وجه كاملة على الهاتف: إخفاء القوائم + إبقاء الشاشة مضاءة */
export function useDialysisFaceSession(active: boolean): void {
  const isMobile = useDialysisMobile();
  useDialysisOverlayLock(isMobile && active);
  useDialysisWakeLock(active);
}
