import { useEffect, useRef, useState } from 'react';
import { FACE_QUALITY_POLL_MS, FACE_QUALITY_POLL_MOBILE_MS } from './dialysisFaceConfig';
import { useDialysisMobile } from '../app/useDialysisMobile';
import { previewFaceQuality } from './dialysisFaceRuntime';
import type { FaceQualitySnapshot } from './dialysisFaceQuality';

export function useFaceQualityPreview(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  pollMs?: number
): FaceQualitySnapshot | null {
  const isMobile = useDialysisMobile();
  const intervalMs = pollMs ?? (isMobile ? FACE_QUALITY_POLL_MOBILE_MS : FACE_QUALITY_POLL_MS);
  const [quality, setQuality] = useState<FaceQualitySnapshot | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setQuality(null);
      return undefined;
    }

    let cancelled = false;
    let hidden = document.hidden;

    const onVisibility = () => {
      hidden = document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);

    const tick = async () => {
      if (cancelled || busyRef.current || hidden) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      busyRef.current = true;
      try {
        const snap = await previewFaceQuality(video);
        if (!cancelled && !hidden) setQuality(snap);
      } catch {
        /* ignore preview errors */
      } finally {
        busyRef.current = false;
      }
    };

    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);
    void tick();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(id);
    };
  }, [videoRef, enabled, intervalMs]);

  return quality;
}
