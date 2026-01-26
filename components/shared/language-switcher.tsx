"use client";

import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { stripLocaleFromPathname } from "@/lib/i18n-pathname";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LanguageIcon } from "@/components/ui/custom-icons";

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
  const pathname = stripLocaleFromPathname(rawPathname);
  const params = useParams();
  const [, startTransition] = useTransition();

  const handleChange = (newLocale: Locale | null) => {
    if (!newLocale) return;
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- TypeScript will validate that only known `params`
        // are used in combination with a given `pathname`. Since the two will
        // always match for the current route, we can skip runtime checks.
        { pathname, params },
        { locale: newLocale }
      );
    });
  };

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-auto gap-2 border border-zinc-300 dark:border-zinc-700 bg-secondary px-2 shadow-sm hover:bg-accent">
        <LanguageIcon className="size-4 text-muted-foreground" />
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
