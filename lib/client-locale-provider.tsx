"use client";

import * as React from "react";
import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages } from "next-intl";
import { defaultLocale, type Locale } from "@/i18n/routing";
import { stripLocaleFromPathname } from "@/lib/i18n-pathname";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadMessages(locale: Locale): Promise<AbstractIntlMessages> {
  switch (locale) {
    case "en": return (await import("@/messages/en.json")).default;
    case "pt": return (await import("@/messages/pt.json")).default;
    case "de": return (await import("@/messages/de.json")).default;
    case "zh": return (await import("@/messages/zh.json")).default;
    case "es": return (await import("@/messages/es.json")).default;
    case "nl": return (await import("@/messages/nl.json")).default;
    default:   return (await import("@/messages/en.json")).default;
  }
}

/** Rewrite the browser URL to reflect the new locale without a navigation. */
function updateUrl(newLocale: Locale) {
  const stripped = stripLocaleFromPathname(window.location.pathname);
  const newPath = newLocale === defaultLocale
    ? stripped
    : `/${newLocale}${stripped}`;
  const search = window.location.search;
  const hash = window.location.hash;
  window.history.replaceState(null, "", `${newPath}${search}${hash}`);
}

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

  const switchLocale = React.useCallback(async (newLocale: Locale) => {
    if (newLocale === locale) return;
    const newMessages = await loadMessages(newLocale);
    setLocale(newLocale);
    setMessages(newMessages);
    document.documentElement.lang = newLocale;
    updateUrl(newLocale);
  }, [locale]);

  return (
    <LocaleSwitchContext.Provider value={{ switchLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleSwitchContext.Provider>
  );
}
