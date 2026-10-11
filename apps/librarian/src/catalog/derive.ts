import type {
  collection,
  company,
  cover,
  externalGame,
  game,
  gameLocalization,
  gameMode,
  gameToCompany,
  genre,
  platform,
  screenshot,
  theme,
  type,
  video,
  website,
  websiteType,
} from "@playdamnit/db/schema";
import { ImageSource, ReleaseDatePrecision } from "@playdamnit/db/enums";

import type { IGDBGameResponse, IGDBNamed, IGDBTyped } from "../utils/igdb/types";

// Games rated by at least this many IGDB users count as popular (used for search ranking)
const POPULAR_RATING_COUNT = 100;

// IGDB date_formats ids → how precise first_release_date is
const DATE_PRECISION: Record<number, ReleaseDatePrecision> = {
  0: ReleaseDatePrecision.Day,
  1: ReleaseDatePrecision.Month,
  2: ReleaseDatePrecision.Year,
  3: ReleaseDatePrecision.Quarter,
  4: ReleaseDatePrecision.Quarter,
  5: ReleaseDatePrecision.Quarter,
  6: ReleaseDatePrecision.Quarter,
  7: ReleaseDatePrecision.Tbd,
};

type GameRow = typeof game.$inferInsert;
type PlatformRow = typeof platform.$inferInsert;

export interface DerivedGame {
  game: GameRow;
  lookups: {
    platforms: PlatformRow[];
    genres: (typeof genre.$inferInsert)[];
    gameModes: (typeof gameMode.$inferInsert)[];
    themes: (typeof theme.$inferInsert)[];
    gameTypes: (typeof type.$inferInsert)[];
    websiteTypes: (typeof websiteType.$inferInsert)[];
    companies: (typeof company.$inferInsert)[];
    collections: (typeof collection.$inferInsert)[];
  };
  cover: typeof cover.$inferInsert | null;
  screenshots: (typeof screenshot.$inferInsert)[];
  websites: (typeof website.$inferInsert)[];
  videos: (typeof video.$inferInsert)[];
  externalGames: (typeof externalGame.$inferInsert)[];
  localizations: (typeof gameLocalization.$inferInsert)[];
  platformIds: number[];
  genreIds: number[];
  gameModeIds: number[];
  themeIds: number[];
  collectionIds: number[];
  companyRoles: (typeof gameToCompany.$inferInsert)[];
}

const unixToDate = (seconds: number | undefined): Date | null =>
  seconds ? new Date(seconds * 1000) : null;

const named = (rows: IGDBNamed[] | undefined) =>
  (rows ?? []).map(({ id, name, slug }) => ({ id, name, slug }));

const uniqueIds = (rows: { id: number }[] | undefined) => [
  ...new Set((rows ?? []).map((row) => row.id)),
];

/** The precision of first_release_date, taken from the release date that defines it. */
const releasePrecision = (raw: IGDBGameResponse): ReleaseDatePrecision | null => {
  if (!raw.first_release_date || !raw.release_dates?.length) return null;
  const first = raw.release_dates
    .filter((rd) => rd.date === raw.first_release_date && rd.date_format !== undefined)
    .toSorted((a, b) => (a.date_format ?? 99) - (b.date_format ?? 99))[0];
  return first ? (DATE_PRECISION[first.date_format!] ?? null) : null;
};

/**
 * Turn one expanded IGDB game into rows for every catalog table. Pure: the same input always
 * gives the same output, except `lastSyncedAt`, which is `now`.
 */
export const deriveGame = (raw: IGDBGameResponse, now: Date): DerivedGame => {
  const alternativeNames = [
    ...new Set((raw.alternative_names ?? []).map((alt) => alt.name).filter(Boolean)),
  ];
  const companies = (raw.involved_companies ?? [])
    .map((ic) => ic.company)
    .filter((c): c is IGDBNamed => !!c && typeof c === "object");
  const companyRoles = new Map<number, typeof gameToCompany.$inferInsert & { companyId: number }>();
  for (const ic of raw.involved_companies ?? []) {
    if (!ic.company || typeof ic.company !== "object") continue;
    const current = companyRoles.get(ic.company.id) ?? {
      gameId: raw.id,
      companyId: ic.company.id,
      developer: false,
      publisher: false,
      porting: false,
      supporting: false,
    };
    companyRoles.set(ic.company.id, {
      ...current,
      developer: current.developer || !!ic.developer,
      publisher: current.publisher || !!ic.publisher,
      porting: current.porting || !!ic.porting,
      supporting: current.supporting || !!ic.supporting,
    });
  }
  const websiteTypes = (raw.websites ?? [])
    .map((ws) => ws.type)
    .filter((t): t is IGDBTyped => !!t && typeof t === "object");

  return {
    game: {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      summary: raw.summary ?? null,
      storyline: raw.storyline ?? null,
      firstReleaseDate: raw.first_release_date ?? null,
      firstReleaseDatePrecision: releasePrecision(raw),
      totalRating: raw.total_rating ?? null,
      totalRatingCount: raw.total_rating_count ?? null,
      isPopular: (raw.total_rating_count ?? 0) >= POPULAR_RATING_COUNT,
      gameType: raw.game_type?.id ?? null,
      parentGameId: raw.parent_game ?? null,
      versionParentId: raw.version_parent ?? null,
      alternativeNames,
      searchNames: [raw.name, ...alternativeNames].join(" "),
      similarGameIds: [...new Set(raw.similar_games ?? [])],
      raw: raw as unknown as Record<string, unknown>,
      igdbUpdatedAt: unixToDate(raw.updated_at),
      lastSyncedAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    lookups: {
      platforms: (raw.platforms ?? []).map(({ id, name, slug, abbreviation }) => ({
        id,
        name,
        slug,
        abbreviation: abbreviation ?? null,
      })),
      genres: named(raw.genres),
      gameModes: named(raw.game_modes),
      themes: named(raw.themes),
      gameTypes: raw.game_type ? [{ id: raw.game_type.id, type: raw.game_type.type }] : [],
      websiteTypes: websiteTypes.map(({ id, type: name }) => ({ id, type: name })),
      companies: named(companies),
      collections: named(raw.collections),
    },
    cover: raw.cover
      ? {
          id: raw.cover.id,
          gameId: raw.id,
          hash: raw.cover.image_id,
          source: ImageSource.Igdb,
          width: raw.cover.width ?? null,
          height: raw.cover.height ?? null,
        }
      : null,
    screenshots: (raw.screenshots ?? []).map((ss) => ({
      id: ss.id,
      gameId: raw.id,
      hash: ss.image_id,
      source: ImageSource.Igdb,
      width: ss.width ?? null,
      height: ss.height ?? null,
    })),
    websites: (raw.websites ?? []).map((ws) => ({
      id: ws.id,
      gameId: raw.id,
      url: ws.url,
      trusted: ws.trusted ?? false,
      typeId: ws.type?.id ?? null,
    })),
    videos: (raw.videos ?? [])
      .filter((v) => !!v.video_id)
      .map((v) => ({ id: v.id, gameId: raw.id, name: v.name ?? null, videoId: v.video_id })),
    externalGames: (raw.external_games ?? []).map((eg) => ({
      id: eg.id,
      gameId: raw.id,
      sourceId: eg.external_game_source ?? null,
      name: eg.name ?? null,
      uid: eg.uid ?? null,
      url: eg.url ?? null,
    })),
    localizations: (raw.game_localizations ?? []).map((loc) => ({
      id: loc.id,
      gameId: raw.id,
      name: loc.name ?? null,
      regionId: loc.region ?? null,
      coverHash: loc.cover?.image_id ?? null,
      coverWidth: loc.cover?.width ?? null,
      coverHeight: loc.cover?.height ?? null,
    })),
    platformIds: uniqueIds(raw.platforms),
    genreIds: uniqueIds(raw.genres),
    gameModeIds: uniqueIds(raw.game_modes),
    themeIds: uniqueIds(raw.themes),
    collectionIds: uniqueIds(raw.collections),
    companyRoles: [...companyRoles.values()],
  };
};
