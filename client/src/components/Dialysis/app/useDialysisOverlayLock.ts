import { useEffect } from 'react';

/** يخفي الشريط السفلي وFAB عند فتح درج/نافذة فوق واجهة الموبايل */
export function useDialysisOverlayLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    document.body.classList.add('d-dialysis-overlay-open');
    return () => document.body.classList.remove('d-dialysis-overlay-open');
  }, [active]);
}
