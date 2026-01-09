export const locales = ['en', 'pt', 'de', 'zh', 'es', 'nl'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

export const nonDefaultLocales = locales.filter((l) => l !== defaultLocale);

export function isLocale(candidate: string | undefined | null): candidate is Locale {
  return typeof candidate === 'string' && locales.includes(candidate as Locale);
}
