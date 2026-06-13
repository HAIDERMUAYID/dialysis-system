import { useEffect } from 'react';
import { DIALYSIS_FACE_ENABLED } from './dialysisFaceConfig';
import { loadDialysisFaceModels } from './dialysisFaceRuntime';

/** تحميل نماذج الوجه في الخلفية لتسريع أول فتح للكامره */
export function usePreloadDialysisFaceModels(enabled = DIALYSIS_FACE_ENABLED): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const idle =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 1200);

    const cancel =
      typeof window.cancelIdleCallback === 'function'
        ? window.cancelIdleCallback
        : window.clearTimeout;

    const id = idle(() => {
      void loadDialysisFaceModels();
    });

    return () => {
      cancel(id as number);
    };
  }, [enabled]);
}
