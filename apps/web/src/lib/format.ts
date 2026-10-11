import { GameFirstReleaseDatePrecision } from "@playdamnit/api-client";

import i18n, { t } from "@/i18n";
import { format, formatDistanceToNowStrict } from "@/i18n/date";
import { DateFormat } from "@/lib/enums";

/** IGDB's game_type ids 0–14 have names in the `gameType` locale block; others fall back to IGDB's own */
export const gameTypeName = (id: number | null | undefined, fallback?: string) => {
  if (id !== null && id !== undefined && id >= 0 && id <= 14) {
    return t(`gameType.${id as 0}`);
  }
  return fallback ?? null;
};

/** Year of an IGDB unix timestamp */
export const releaseYear = (ts: number | null | undefined): string | null =>
  ts ? String(new Date(ts * 1000).getUTCFullYear()) : null;

/** Full release date honouring IGDB's precision (year, month, day, quarter, tbd) */
export const releaseDate = (
  ts: number | null | undefined,
  precision?: GameFirstReleaseDatePrecision | null,
): string | null => {
  if (!ts) return precision === GameFirstReleaseDatePrecision.Tbd ? t("dates.tbd") : null;
  const date = new Date(ts * 1000);
  switch (precision) {
    case GameFirstReleaseDatePrecision.Year:
      return String(date.getUTCFullYear());
    case GameFirstReleaseDatePrecision.Month:
      return format(date, DateFormat.MonthYear);
    case GameFirstReleaseDatePrecision.Quarter:
      return t("dates.quarter", {
        quarter: Math.floor(date.getUTCMonth() / 3) + 1,
        year: date.getUTCFullYear(),
      });
    default:
      return format(date, DateFormat.MonthDayYear);
  }
};

export const shortDate = (iso: string | null | undefined): string | null =>
  iso ? format(new Date(iso), DateFormat.MonthDayYearShort) : null;

export const relativeDate = (iso: string | null | undefined): string | null =>
  iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : null;

/** IGDB stores time-to-beat in seconds */
export const formatHours = (seconds: number | null | undefined): string | null => {
  if (!seconds) return null;
  const hours = seconds / 3600;
  return t("units.hours", { value: hours >= 10 ? Math.round(hours) : Math.round(hours * 2) / 2 });
};

export const compactNumber = (n: number): string =>
  Intl.NumberFormat(i18n.language, { notation: "compact" }).format(n);
