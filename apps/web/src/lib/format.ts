import i18n, { t } from "@/i18n";
import { format, formatDistanceToNowStrict } from "@/i18n/date";

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
  precision?: string | null,
): string | null => {
  if (!ts) return precision === "tbd" ? t("dates.tbd") : null;
  const date = new Date(ts * 1000);
  switch (precision) {
    case "year":
      return String(date.getUTCFullYear());
    case "month":
      return format(date, "MMMM yyyy");
    case "quarter":
      return t("dates.quarter", {
        quarter: Math.floor(date.getUTCMonth() / 3) + 1,
        year: date.getUTCFullYear(),
      });
    default:
      return format(date, "MMMM d, yyyy");
  }
};

export const shortDate = (iso: string | null | undefined): string | null =>
  iso ? format(new Date(iso), "MMM d, yyyy") : null;

export const relativeDate = (iso: string | null | undefined): string | null =>
  iso ? formatDistanceToNowStrict(new Date(iso), { addSuffix: true }) : null;

export const formatRating = (rating: number | null | undefined): string | null =>
  rating === null || rating === undefined || rating === 0 ? null : rating.toFixed(1);

/** Colour class for a 0–10 rating, matching the reference design's three bands */
export const ratingColor = (rating: number): string =>
  rating >= 7 ? "text-rating-high" : rating >= 4 ? "text-rating-mid" : "text-rating-low";

/** IGDB stores time-to-beat in seconds */
export const formatHours = (seconds: number | null | undefined): string | null => {
  if (!seconds) return null;
  const hours = seconds / 3600;
  return t("units.hours", { value: hours >= 10 ? Math.round(hours) : Math.round(hours * 2) / 2 });
};

export const compactNumber = (n: number): string =>
  Intl.NumberFormat(i18n.language, { notation: "compact" }).format(n);
