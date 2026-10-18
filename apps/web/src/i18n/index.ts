import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import changelogEn from "./locales/changelog/en.json";
import en from "./locales/en.json";
import legalEn from "./locales/legal/en.json";

/**
 * UI text lives in `locales/<language>.json`, one nested file per language. English is the
 * source of truth: its shape types every `t("some.key")` call (see `i18next.d.ts`), so a typo
 * or a missing key fails `tsc`. To add a language, drop a `<code>.json` next to `en.json`,
 * register it in `resources` and `SUPPORTED_LANGUAGES`. The changelog has its own file per
 * language under `locales/changelog/`.
 *
 * Not translated on purpose: game data from IGDB (names, genres, platforms), user-written text
 * (reviews, bios, list names) and messages that come back from the API.
 */
export enum Language {
  English = "en",
}
export const SUPPORTED_LANGUAGES = Object.values(Language);
export const DEFAULT_LANGUAGE = Language.English;

/** The changelog keeps its own file per language, apart from the UI text */
export enum Namespace {
  Translation = "translation",
  Changelog = "changelog",
  Legal = "legal",
}

export const resources = {
  [Language.English]: {
    [Namespace.Translation]: en,
    [Namespace.Changelog]: changelogEn,
    [Namespace.Legal]: legalEn,
  },
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
