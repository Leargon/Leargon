import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import type { LocalizedText } from '../api/generated/model';

interface LocaleContextType {
  preferredLocale: string;
  setPreferredLocale: (locale: string) => void;
  getLocalizedText: (translations: LocalizedText[] | undefined, fallback?: string) => string;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export const useLocale = (): LocaleContextType => {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return context;
};

interface LocaleProviderProps {
  children: ReactNode;
}

const LOCALE_STORAGE_KEY = 'leargon-preferred-locale';

export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children }) => {
  const [preferredLocale, setPreferredLocaleState] = useState<string>(() => {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || 'en';
  });

  const setPreferredLocale = useCallback((locale: string) => {
    setPreferredLocaleState(locale);
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, []);

  const getLocalizedText = useCallback((translations: LocalizedText[] | undefined, fallback = ''): string => {
    if (!translations || translations.length === 0) return fallback;

    // Try preferred locale
    const preferred = translations.find(t => t.locale === preferredLocale);
    if (preferred) return preferred.text;

    // Fallback to English
    const en = translations.find(t => t.locale === 'en');
    if (en) return en.text;

    // Fallback to first translation
    return translations[0].text || fallback;
  }, [preferredLocale]);

  const value: LocaleContextType = {
    preferredLocale,
    setPreferredLocale,
    getLocalizedText,
  };

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};
