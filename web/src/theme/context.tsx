import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ThemeMode } from './types.js';

const THEME_STORAGE_KEY = 'lsqlite-theme-mode';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored;
  return 'auto';
}

function getSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(mode: ThemeMode) {
  if (mode === 'auto') return getSystemDark();
  return mode === 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(getSystemDark);

  const setMode = useCallback((next: ThemeMode) => {
    switch (next) {
      case 'light':
      case 'dark':
      case 'auto':
        localStorage.setItem(THEME_STORAGE_KEY, next);
        setModeState(next);
        return;
      default: {
        const unexpected: never = next;
        throw new Error(`Unsupported theme mode: ${unexpected}`);
      }
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const isDark = mode === 'auto' ? systemDark : mode === 'dark';

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  }, [isDark]);

  const value = useMemo(() => ({ mode, setMode, isDark }), [isDark, mode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
