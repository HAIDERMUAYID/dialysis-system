import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider, theme as antdThemeApi } from 'antd';
import arEG from 'antd/locale/ar_EG';
import { antdTheme } from '../../../config/antd.config';
import {
  DIALYSIS_THEME_LABELS,
  loadDialysisThemeMode,
  resolveDialysisTheme,
  saveDialysisThemeMode,
  type DialysisThemeMode,
} from './dialysisTheme';

interface DialysisThemeContextValue {
  mode: DialysisThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: DialysisThemeMode) => void;
  cycleMode: () => void;
  label: string;
}

const DialysisThemeContext = createContext<DialysisThemeContextValue | null>(null);

const MODE_CYCLE: DialysisThemeMode[] = ['light', 'dark', 'system'];

export const DialysisThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<DialysisThemeMode>(() => loadDialysisThemeMode());
  const [resolved, setResolved] = useState<'light' | 'dark'>(() => resolveDialysisTheme(mode));

  const applyResolved = useCallback((nextMode: DialysisThemeMode) => {
    const next = resolveDialysisTheme(nextMode);
    setResolved((prev) => (prev === next ? prev : next));
  }, []);

  const setMode = useCallback(
    (next: DialysisThemeMode) => {
      setModeState(next);
      saveDialysisThemeMode(next);
      applyResolved(next);
    },
    [applyResolved]
  );

  const cycleMode = useCallback(() => {
    const idx = MODE_CYCLE.indexOf(mode);
    setMode(MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]);
  }, [mode, setMode]);

  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyResolved('system');
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [mode, applyResolved]);

  const value = useMemo(
    () => ({
      mode,
      resolved,
      setMode,
      cycleMode,
      label: DIALYSIS_THEME_LABELS[mode],
    }),
    [mode, resolved, setMode, cycleMode]
  );

  const isDark = resolved === 'dark';

  const antdThemeConfig = useMemo(
    () => ({
      ...antdTheme,
      algorithm: isDark ? antdThemeApi.darkAlgorithm : antdThemeApi.defaultAlgorithm,
      token: {
        ...antdTheme.token,
        colorPrimary: isDark ? '#5eead4' : '#157c67',
      },
    }),
    [isDark]
  );

  return (
    <DialysisThemeContext.Provider value={value}>
      <div
        className={isDark ? 'dark-mode d-app-theme-shell' : 'd-app-theme-shell'}
        data-theme={resolved}
      >
        <ConfigProvider
          locale={arEG}
          direction="rtl"
          getPopupContainer={(triggerNode) => triggerNode?.parentElement ?? document.body}
          theme={antdThemeConfig}
        >
          {children}
        </ConfigProvider>
      </div>
    </DialysisThemeContext.Provider>
  );
};

export function useDialysisTheme(): DialysisThemeContextValue {
  const ctx = useContext(DialysisThemeContext);
  if (!ctx) {
    throw new Error('useDialysisTheme must be used within DialysisThemeProvider');
  }
  return ctx;
}
