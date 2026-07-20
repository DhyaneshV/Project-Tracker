import React, { createContext, useContext, useState, useCallback } from 'react';
import { en } from './en';
import { hi } from './hi';

/**
 * Lightweight i18n system.
 * 
 * Supports: English (en), Hindi (hi)
 * 
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   <p>{t('auth.signIn')}</p>
 *   <button onClick={() => setLocale('hi')}>हिंदी</button>
 * 
 * To add a new language: create a new file (e.g., ta.ts) with the same keys,
 * import it here, and add it to the `translations` map.
 */

export type Locale = 'en' | 'hi';

type TranslationMap = Record<string, string>;

const translations: Record<Locale, TranslationMap> = { en, hi };

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem('locale') as Locale) || 'en';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.setAttribute('lang', newLocale);
  }, []);

  const t = useCallback((key: string, fallback?: string): string => {
    return translations[locale]?.[key] || translations.en[key] || fallback || key;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

/** Available locales for the language picker */
export const AVAILABLE_LOCALES: { code: Locale; label: string; nativeLabel: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
];
