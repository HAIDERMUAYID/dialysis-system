/**
 * Undo/Redo Hook
 * يدعم التراجع والإعادة للعمليات
 */

import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export const useUndoRedo = <T>(initialState: T, maxHistory: number = 50) => {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const setState = useCallback((newState: T) => {
    setHistory((prev) => {
      const newPast = [...prev.past, prev.present].slice(-maxHistory);
      return {
        past: newPast,
        present: newState,
        future: [], // Clear future when new action is performed
      };
    });
  }, [maxHistory]);

  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory((prev) => {
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);

      return {
        past: newPast,
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory((prev) => {
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);

      return {
        past: [...prev.past, prev.present],
        present: next,
        future: newFuture,
      };
    });
  }, [canRedo]);

  const reset = useCallback((newState: T) => {
    setHistory({
      past: [],
      present: newState,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    history: {
      past: history.past.length,
      future: history.future.length,
    },
  };
};
