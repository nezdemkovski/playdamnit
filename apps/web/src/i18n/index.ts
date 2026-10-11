import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

/**
 * UI text lives in `locales/<language>.json`, one nested file per language. English is the
 * source of truth: its shape types every `t("some.key")` call (see `i18next.d.ts`), so a typo
 * or a missing key fails `tsc`. To add a language, drop a `<code>.json` next to `en.json`,
 * register it in `resources` and `SUPPORTED_LANGUAGES`.
 *
 * Not translated on purpose: game data from IGDB (names, genres, platforms), user-written text
 * (reviews, bios, list names) and messages that come back from the API.
 */
export const SUPPORTED_LANGUAGES = ["en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

export const resources = {
  en: { translation: en },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  // React already escapes what it renders
  interpolation: { escapeValue: false },
  returnNull: false,
});

// Keep <html lang> in step with the active language (screen readers, hyphenation)
i18n.on("languageChanged", (language) => {
  document.documentElement.lang = language;
});

export default i18n;
export const t = i18n.t.bind(i18n);
