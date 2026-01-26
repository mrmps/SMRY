# next-intl Locale Switching

## When to Use This Skill

Apply this when working with locale/language switching in this Next.js app that uses next-intl.

## Key Rule

**NEVER use `window.location.href` for locale switching.** Always use next-intl's `useRouter` with the `locale` option.

## Why

This project uses `localePrefix: 'as-needed'` in `i18n/routing.ts`, meaning:
- English (default): No URL prefix (`/proxy`)
- Other locales: URL prefix (`/pt/proxy`, `/de/proxy`)

When you use `window.location.href` to navigate to a URL without a locale prefix (English), next-intl's middleware checks cookies/headers for stored locale preference and redirects back to the previous locale.

## Correct Pattern

```typescript
import { usePathname, useRouter } from "@/i18n/navigation";
import { stripLocaleFromPathname } from "@/lib/i18n-pathname";

function useLocaleSwitch() {
  const router = useRouter();
  const rawPathname = usePathname();
  const searchParams = useSearchParams();

  return (newLocale: Locale) => {
    const pathname = stripLocaleFromPathname(rawPathname);
    const search = searchParams.toString();
    const fullPath = `${pathname}${search ? `?${search}` : ''}`;

    // This explicitly tells next-intl which locale to use
    router.replace(fullPath, { locale: newLocale });
  };
}
```

## Wrong Pattern

```typescript
// DON'T DO THIS - bypasses next-intl locale handling
const localePrefix = newLocale === 'en' ? '' : `/${newLocale}`;
window.location.href = `${localePrefix}${pathname}`;
```

## Reference Implementations

- `components/shared/language-switcher.tsx` - Uses `router.replace()` with locale
- `components/shared/bottom-corner-nav.tsx` - Uses `<Link>` with locale prop
- `components/features/proxy-content.tsx` - Uses `router.replace()` with locale

## Documentation

- [next-intl Navigation API](https://next-intl-docs.vercel.app/docs/routing/navigation)
- [next-intl Locale Prefix Strategies](https://next-intl-docs.vercel.app/docs/routing#locale-prefix)
