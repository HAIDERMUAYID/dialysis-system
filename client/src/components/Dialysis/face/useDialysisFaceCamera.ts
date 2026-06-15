import { useCallback, useEffect, useRef, useState } from 'react';
import { loadDialysisFaceModels, startFaceCamera, type FaceCameraFacing } from './dialysisFaceRuntime';

const STORAGE_KEY = 'd-dialysis-face-camera-facing';

export function readSavedFaceCameraFacing(): FaceCameraFacing {
  if (typeof window === 'undefined') return 'environment';
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'user' || saved === 'environment') return saved;
  // افتراضي: خلفية (أفضل لتصوير المريض) — مع إمكانية التبديل للأمامية
  return 'environment';
}

export function saveFaceCameraFacing(facing: FaceCameraFacing): void {
  try {
    localStorage.setItem(STORAGE_KEY, facing);
  } catch {
    /* ignore */
  }
}

export function faceCameraFacingLabel(facing: FaceCameraFacing): string {
  return facing === 'environment' ? 'خلفية' : 'أمامية';
}

export function useDialysisFaceCamera(open: boolean) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopCameraRef = useRef<(() => void) | null>(null);
  const [facing, setFacing] = useState<FaceCameraFacing>(readSavedFaceCameraFacing);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [loadHint, setLoadHint] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cleanupCamera = useCallback(() => {
    stopCameraRef.current?.();
    stopCameraRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const flipCamera = useCallback(() => {
    setFacing((prev) => {
      const next: FaceCameraFacing = prev === 'user' ? 'environment' : 'user';
      saveFaceCameraFacing(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) {
      cleanupCamera();
      setPhase('idle');
      setError(null);
      setLoadHint('');
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        cleanupCamera();
        setPhase('loading');
        setError(null);
        await loadDialysisFaceModels(setLoadHint);
        const { stream, stop } = await startFaceCamera(facing);
        if (cancelled) {
          stop();
          return;
        }
        stopCameraRef.current = stop;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setPhase('ready');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'تعذر فتح الكامره';
        setError(msg);
        setPhase('idle');
      }
    })();

    return () => {
      cancelled = true;
      cleanupCamera();
    };
  }, [open, facing, cleanupCamera]);

  return {
    videoRef,
    facing,
    flipCamera,
    phase,
    loadHint,
    error,
    setError,
  };
}
