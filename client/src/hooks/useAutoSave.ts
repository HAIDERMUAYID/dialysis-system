/**
 * Auto-save Hook
 * يحفظ البيانات تلقائياً كل فترة زمنية محددة
 */

import { useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';

interface UseAutoSaveOptions {
  data: any;
  onSave: (data: any) => Promise<void> | void;
  interval?: number; // milliseconds
  enabled?: boolean;
  onSaveStart?: () => void;
  onSaveSuccess?: () => void;
  onSaveError?: (error: any) => void;
}

export const useAutoSave = ({
  data,
  onSave,
  interval = 30000, // 30 seconds default
  enabled = true,
  onSaveStart,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions) => {
  const dataRef = useRef(data);
  const lastSaveRef = useRef<number>(Date.now());
  const isSavingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update data ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const performSave = useCallback(async () => {
    if (isSavingRef.current || !enabled) return;

    try {
      isSavingRef.current = true;
      onSaveStart?.();
      
      await onSave(dataRef.current);
      
      lastSaveRef.current = Date.now();
      onSaveSuccess?.();
    } catch (error) {
      console.error('Auto-save error:', error);
      onSaveError?.(error);
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave, enabled, onSaveStart, onSaveSuccess, onSaveError]);

  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const scheduleSave = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const timeSinceLastSave = Date.now() - lastSaveRef.current;
      const delay = Math.max(0, interval - timeSinceLastSave);

      timeoutRef.current = setTimeout(() => {
        performSave();
        scheduleSave(); // Schedule next save
      }, delay);
    };

    scheduleSave();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [interval, enabled, performSave]);

  // Save on unmount
  useEffect(() => {
    return () => {
      if (enabled && dataRef.current) {
        performSave();
      }
    };
  }, [enabled, performSave]);

  return {
    save: performSave,
    isSaving: isSavingRef.current,
    lastSave: lastSaveRef.current,
  };
};
