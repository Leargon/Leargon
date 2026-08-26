import React, { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect } from 'react';
import type { LocalizedText, SupportedLocaleResponse } from '../api/generated/model';
import { useGetSupportedLocales } from '../api/generated/locale/locale';
import i18n from '../i18n';

interface LocaleContextType {
  preferredLocale: string;
  /** The locale this tenant configured as its default — the silent fallback for untranslated content. */
  defaultLocale: string;
  setPreferredLocale: (locale: string) => void;
  getLocalizedText: (translations: LocalizedText[] | undefined, fallback?: string) => string;
  /**
   * The display name of a `*SummaryResponse` — the owning unit of an entity, the parent of a process,
   * a bounded context, and so on. Reads the summary's localised `names` list and falls back to its flat
   * `name` (tenant default locale) and then its key, so a client is never left with a blank chip.
   */
  localizedName: (summary: NamedSummary | null | undefined) => string;
}

/**
 * Anything the API returns as a summary of a named item. `names` is the localised list; `name` is the
 * tenant-default-locale fallback the backend still ships for compatibility.
 */
export interface NamedSummary {
  key: string;
  name?: string | null;
  names?: LocalizedText[] | null;
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

/**
 * Last-resort locale, used only before the tenant's supported locales have loaded. It is not a
 * statement that English is special — the tenant default takes over as soon as it is known.
 */
const BOOTSTRAP_LOCALE = 'en';

export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children }) => {
  const { data: localesResponse } = useGetSupportedLocales();

  /**
   * The tenant default locale. Content with no text in the reader's language silently falls back to
   * this rather than to English, which is what made a German-only catalogue read as English.
   */
  const defaultLocale = useMemo(() => {
    const locales = (localesResponse?.data as SupportedLocaleResponse[] | undefined) ?? [];
    return locales.find((l) => l.isDefault)?.localeCode ?? BOOTSTRAP_LOCALE;
  }, [localesResponse]);

  const [preferredLocale, setPreferredLocaleState] = useState<string>(
    () => localStorage.getItem(LOCALE_STORAGE_KEY) || BOOTSTRAP_LOCALE,
  );

  // A first-time visitor has no stored choice. Adopt the tenant default (once it is known) rather than
  // leaving them on English, which for a German tenant is nobody's language.
  useEffect(() => {
    if (localStorage.getItem(LOCALE_STORAGE_KEY)) return;
    if (defaultLocale === preferredLocale) return;
    setPreferredLocaleState(defaultLocale);
    void i18n.changeLanguage(defaultLocale);
  }, [defaultLocale, preferredLocale]);

  const setPreferredLocale = useCallback((locale: string) => {
    setPreferredLocaleState(locale);
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    void i18n.changeLanguage(locale);
  }, []);

  const getLocalizedText = useCallback(
    (translations: LocalizedText[] | undefined, fallback = ''): string => {
      if (!translations || translations.length === 0) return fallback;

      // The reader's own language, provided somebody actually filled it in.
      const preferred = translations.find((t) => t.locale === preferredLocale && t.text);
      if (preferred) return preferred.text;

      // Otherwise the tenant default locale, silently.
      const fallbackLocale = translations.find((t) => t.locale === defaultLocale && t.text);
      if (fallbackLocale) return fallbackLocale.text;

      // Any locale that has text beats showing nothing.
      return translations.find((t) => t.text)?.text || fallback;
    },
    [preferredLocale, defaultLocale],
  );

  const localizedName = useCallback(
    (summary: NamedSummary | null | undefined): string =>
      summary ? getLocalizedText(summary.names ?? undefined, summary.name || summary.key) : '',
    [getLocalizedText],
  );

  const value: LocaleContextType = useMemo(
    () => ({ preferredLocale, defaultLocale, setPreferredLocale, getLocalizedText, localizedName }),
    [preferredLocale, defaultLocale, setPreferredLocale, getLocalizedText, localizedName],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};
