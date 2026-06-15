export type DialysisThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'd-irs-theme';

export function loadDialysisThemeMode(): DialysisThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export function saveDialysisThemeMode(mode: DialysisThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function resolveDialysisTheme(mode: DialysisThemeMode): 'light' | 'dark' {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export const DIALYSIS_THEME_LABELS: Record<DialysisThemeMode, string> = {
  light: 'فاتح',
  dark: 'داكن',
  system: 'تلقائي (النظام)',
};
