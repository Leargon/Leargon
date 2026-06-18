import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json';

countries.registerLocale(en);

const allCodes = countries.getAlpha2Codes();

export const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  Object.keys(allCodes).map((code) => [code, countries.getName(code, 'en') ?? code]),
);

export const COUNTRY_OPTIONS: { code: string; name: string }[] = Object.entries(COUNTRY_NAMES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}
