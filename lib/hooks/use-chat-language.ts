"use client";

import useLocalStorage from "./use-local-storage";

// All supported chat languages
export const CHAT_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
] as const;

export type ChatLanguageCode = typeof CHAT_LANGUAGES[number]["code"];

const STORAGE_KEY = "smry-chat-language";
const DEFAULT_LANGUAGE: ChatLanguageCode = "en";

export function useChatLanguage() {
  const [language, setLanguage, hasLoaded] = useLocalStorage<ChatLanguageCode>(
    STORAGE_KEY,
    DEFAULT_LANGUAGE
  );

  const currentLanguage = CHAT_LANGUAGES.find(l => l.code === language) || CHAT_LANGUAGES[0];

  return {
    language,
    setLanguage,
    hasLoaded,
    currentLanguage,
    languages: CHAT_LANGUAGES,
    isDefault: language === DEFAULT_LANGUAGE,
  };
}

// Get chat language instruction for AI prompts
export function getChatLanguageInstruction(languageCode: ChatLanguageCode): string {
  if (languageCode === "en") {
    return ""; // No instruction needed for English
  }

  const lang = CHAT_LANGUAGES.find(l => l.code === languageCode);
  if (!lang) return "";

  return `Please respond in ${lang.name} (${lang.nativeName}).`;
}
