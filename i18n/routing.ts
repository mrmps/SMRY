import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'pt', 'de', 'zh', 'es', 'nl'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

export const languageNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  de: "Deutsch",
  zh: "中文",
  es: "Español",
  nl: "Nederlands",
};

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed'
});

/**
 * Non-default locales for middleware matcher pattern.
 * Used in proxy.ts - if you modify locales above, update the matcher pattern:
 * `/(${nonDefaultLocales.join('|')})/:path*`
 */
export const nonDefaultLocales = locales.filter((l) => l !== defaultLocale);
