import {
  format as formatWithLocale,
  formatDistanceToNowStrict as distanceWithLocale,
  type Locale,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";

import { DateFormat } from "@/lib/enums";

import i18n, { Language } from "./index";

/** date-fns locale per app language; add the matching import when a language is added */
const LOCALES: Record<string, Locale> = { [Language.English]: enUS };

export const dateLocale = (): Locale => LOCALES[i18n.language] ?? enUS;

/** `format` from date-fns in the active language */
export const format = (date: Date | number, pattern: DateFormat) =>
  formatWithLocale(date, pattern, { locale: dateLocale() });

/** `formatDistanceToNowStrict` from date-fns in the active language */
export const formatDistanceToNowStrict = (date: Date | number, options?: { addSuffix?: boolean }) =>
  distanceWithLocale(date, { ...options, locale: dateLocale() });
