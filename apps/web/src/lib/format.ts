import { format, formatDistanceToNowStrict } from "date-fns";

const IGDB_TYPE_NAMES: Record<number, string> = {
  0: "Main Game",
  1: "DLC",
  2: "Expansion",
  3: "Bundle",
  4: "Standalone Expansion",
  5: "Mod",
  6: "Episode",
  7: "Season",
  8: "Remake",
  9: "Remaster",
  10: "Expanded Game",
  11: "Port",
  12: "Fork",
  13: "Pack",
  14: "Update",
};

export const gameTypeName = (id: number | null | undefined, fallback?: string) =>
  (id !== null && id !== undefined ? IGDB_TYPE_NAMES[id] : undefined) ?? fallback ?? null;

/** Year of an IGDB unix timestamp */
export const releaseYear = (ts: number | null | undefined): string | null =>
  ts ? String(new Date(ts * 1000).getUTCFullYear()) : null;

/** Full release date honouring IGDB's precision (year, month, day, quarter, tbd) */
export const releaseDate = (
  ts: number | null | undefined,
  precision?: string | null,
): string | null => {
  if (!ts) return precision === "tbd" ? "TBD" : null;
  const date = new Date(ts * 1000);
  switch (precision) {
    case "year":
      return String(date.getUTCFullYear());
    case "month":
      return format(date, "MMMM yyyy");
    case "quarter":
      return `Q${Math.floor(date.getUTCMonth() / 3) + 1} ${date.getUTCFullYear()}`;
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
  return hours >= 10 ? `${Math.round(hours)}h` : `${Math.round(hours * 2) / 2}h`;
};

export const compactNumber = (n: number): string =>
  Intl.NumberFormat("en", { notation: "compact" }).format(n);
