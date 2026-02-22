"use client";

import * as React from "react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { defaultLocale, type Locale } from "@/i18n/routing";
import { stripLocaleFromPathname } from "@/lib/i18n-pathname";

// ---------------------------------------------------------------------------
// Eager-loaded message loaders — webpack code-splits each locale into its own
// chunk so they're available for client-side dynamic import without SSR issues.
// ---------------------------------------------------------------------------

const MESSAGE_LOADERS: Record<Locale, () => Promise<AbstractIntlMessages>> = {
  en: () => import("@/messages/en.json").then((m) => m.default as AbstractIntlMessages),
  pt: () => import("@/messages/pt.json").then((m) => m.default as AbstractIntlMessages),
  de: () => import("@/messages/de.json").then((m) => m.default as AbstractIntlMessages),
  zh: () => import("@/messages/zh.json").then((m) => m.default as AbstractIntlMessages),
  es: () => import("@/messages/es.json").then((m) => m.default as AbstractIntlMessages),
  nl: () => import("@/messages/nl.json").then((m) => m.default as AbstractIntlMessages),
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface LocaleSwitchContextValue {
  switchLocale: (newLocale: Locale) => void;
}

const LocaleSwitchContext = React.createContext<LocaleSwitchContextValue | null>(null);

export function useSwitchLocale() {
  const ctx = React.useContext(LocaleSwitchContext);
  if (!ctx) throw new Error("useSwitchLocale must be used within ClientLocaleProvider");
  return ctx.switchLocale;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ClientLocaleProviderProps {
  initialLocale: Locale;
  initialMessages: AbstractIntlMessages;
  children: React.ReactNode;
}

export function ClientLocaleProvider({
  initialLocale,
  initialMessages,
  children,
}: ClientLocaleProviderProps) {
  const [locale, setLocale] = React.useState<Locale>(initialLocale);
  const [messages, setMessages] = React.useState<AbstractIntlMessages>(initialMessages);

  // Sync <html lang> on mount — fixes mismatch when root layout's getLocale()
  // returns "en" but the [locale] layout provides the correct locale.
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const switchLocale = React.useCallback(async (newLocale: Locale) => {
    if (newLocale === locale) return;

    // 1. Persist preference so middleware uses it on reload
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.documentElement.lang = newLocale;

    // 2. Load the new locale's messages dynamically (client-side only)
    try {
      const newMessages = await MESSAGE_LOADERS[newLocale]();
      setMessages(newMessages);
    } catch {
      // Silently continue — locale still switches, translations may be stale
    }

    // 3. Update locale in context — re-renders translations without any navigation
    setLocale(newLocale);

    // 4. Update the browser URL silently so a hard reload lands on the correct locale
    const stripped = stripLocaleFromPathname(window.location.pathname);
    const newPath = newLocale === defaultLocale
      ? stripped
      : `/${newLocale}${stripped}`;
    window.history.replaceState(null, "", `${newPath}${window.location.search}${window.location.hash}`);
  }, [locale]);

  return (
    <LocaleSwitchContext.Provider value={{ switchLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
        {children}
      </NextIntlClientProvider>
    </LocaleSwitchContext.Provider>
  );
}
