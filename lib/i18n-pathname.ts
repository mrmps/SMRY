import { routing } from "@/i18n/routing";

/**
 * Normalizes a pathname by stripping any locale prefix next-intl might have left
 * on the path (e.g., when usePathname() and useLocale() are briefly out of sync).
 */
export function stripLocaleFromPathname(pathname: string | null) {
  if (!pathname) {
    return "/";
  }

  const localePrefix = routing.locales.find(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)
  );

  return localePrefix ? pathname.slice(localePrefix.length + 1) || "/" : pathname;
}
