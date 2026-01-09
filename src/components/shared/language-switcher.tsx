import { useRouter, useLocation } from "@tanstack/react-router";
import { useLocale } from "@/i18n/provider";
import { locales, defaultLocale, type Locale } from "@/i18n/config";
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
  const locale = useLocale();
  const router = useRouter();
  const location = useLocation();

  const handleChange = (newLocale: string) => {
    // Strip current locale prefix from pathname
    const localePattern = new RegExp(`^/(${locales.join("|")})`);
    const pathWithoutLocale = location.pathname.replace(localePattern, "") || "/";

    // Build new path with locale prefix (default locale has no prefix)
    const newPath =
      newLocale === defaultLocale
        ? pathWithoutLocale
        : `/${newLocale}${pathWithoutLocale === "/" ? "" : pathWithoutLocale}`;

    const suffix = `${location.searchStr}${location.hash}`;
    router.history.push(`${newPath}${suffix}`);
  };

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger className="w-auto gap-2 border border-zinc-300 dark:border-zinc-700 bg-secondary px-2 shadow-sm hover:bg-accent">
        <Globe className="size-4 text-muted-foreground" />
        <span className="hidden sm:inline">{languageNames[locale]}</span>
        <span className="sm:hidden">{languageFlags[locale]}</span>
        <SelectValue className="sr-only" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {locales.map((loc) => (
          <SelectItem key={loc} value={loc}>
            <span className="mr-2">{languageFlags[loc]}</span>
            {languageNames[loc]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
