import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';
import de from 'i18n-iso-countries/langs/de.json';
import fr from 'i18n-iso-countries/langs/fr.json';

countries.registerLocale(en);
countries.registerLocale(de);
countries.registerLocale(fr);

const SUPPORTED_LOCALES = new Set(['en', 'de', 'fr']);
const allCodes = Object.keys(countries.getAlpha2Codes());

export function getCountryName(code: string, locale = 'en'): string {
  const lang = SUPPORTED_LOCALES.has(locale) ? locale : 'en';
  return countries.getName(code, lang) ?? countries.getName(code, 'en') ?? code;
}

export function getCountryOptions(locale = 'en'): { code: string; name: string }[] {
  return allCodes
    .map((code) => ({ code, name: getCountryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
