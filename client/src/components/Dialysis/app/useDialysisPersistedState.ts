import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

export function useDialysisPersistedState<T>(
  storageKey: string,
  initial: T,
  scopeId: number | string | null | undefined
): [T, Dispatch<SetStateAction<T>>] {
  const scopedKey = scopeId != null && scopeId !== '' ? `${storageKey}:${scopeId}` : storageKey;

  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(scopedKey);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(scopedKey, JSON.stringify(state));
    } catch {
      /* ignore quota */
    }
  }, [scopedKey, state]);

  return [state, setState];
}
