import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Locale, TranslateFn } from './types.js';
import { createTranslator } from './translate.js';

const LOCALE_STORAGE_KEY = 'lsqlite-locale';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslateFn;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'en' || stored === 'zh') return stored;
  return 'zh';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readStoredLocale);

  const setLocale = useCallback((next: Locale) => {
    switch (next) {
      case 'en':
      case 'zh':
        localStorage.setItem(LOCALE_STORAGE_KEY, next);
        setLocaleState(next);
        return;
      default: {
        const unexpected: never = next;
        throw new Error(`Unsupported locale: ${unexpected}`);
      }
    }
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}
