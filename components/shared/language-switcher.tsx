"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe } from "lucide-react";

const languageNames: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  de: "Deutsch",
  zh: "中文",
  es: "Español",
  nl: "Nederlands",
};

const languageFlags: Record<Locale, string> = {
  en: "🇺🇸",
  pt: "🇧🇷",
  de: "🇩🇪",
  zh: "🇨🇳",
  es: "🇪🇸",
  nl: "🇳🇱",
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const rawPathname = usePathname();

  // Strip any locale prefix from pathname (workaround for next-intl edge case
  // where usePathname() returns locale-prefixed path, and useLocale() may be
  // out of sync during navigation transitions)
  const localePrefix = routing.locales.find(
    (loc) => rawPathname === `/${loc}` || rawPathname.startsWith(`/${loc}/`)
  );
  const pathname = localePrefix
    ? rawPathname.slice(localePrefix.length + 1) || "/"
    : rawPathname;

  const handleChange = (newLocale: Locale | null) => {
    if (!newLocale) return;

    router.replace(pathname, { locale: newLocale });
  };

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-auto gap-2 border border-zinc-300 dark:border-zinc-700 bg-secondary px-2 shadow-sm hover:bg-accent">
        <Globe className="size-4 text-muted-foreground" />
        <span className="hidden sm:inline">{languageNames[locale]}</span>
        <span className="sm:hidden">{languageFlags[locale]}</span>
        <SelectValue className="sr-only" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="p-0 [&_[data-slot=select-item]]:h-7 [&_[data-slot=select-item]]:py-0">
        {routing.locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <span className="mr-2">{languageFlags[loc]}</span>
            {languageNames[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
