import { getImageUrl, IgdbImageSize } from "@/utils/image";

// Relations loaded for list views (search, catalog, library). Heavy relations are only loaded
// for the detail view.
export const GAME_CARD_WITH = {
  cover: true,
  platforms: true,
  genres: true,
  gameTypeRef: true,
} as const;

export const GAME_DETAIL_WITH = {
  ...GAME_CARD_WITH,
  screenshots: true,
  websites: { with: { websiteType: true } },
  videos: true,
  externalGames: { with: { source: true } },
  collections: true,
  themes: true,
  gameModes: true,
  companyRoles: { with: { company: true } },
  localizations: true,
  timeToBeat: true,
} as const;

// Columns never sent to clients: the raw IGDB document and the search key. Lists also skip
// the similar-game ids, which only the detail view turns into `similarGames`.
export const GAME_DETAIL_COLUMNS = { raw: false, searchNames: false } as const;
export const GAME_CARD_COLUMNS = { ...GAME_DETAIL_COLUMNS, similarGameIds: false } as const;

// What a related game (DLC, edition) carries in the detail view
export const GAME_RELATED_COLUMNS = {
  id: true,
  name: true,
  slug: true,
  gameType: true,
  firstReleaseDate: true,
} as const;

interface Image {
  id: number;
  hash: string;
  source: string;
  width: number | null;
  height: number | null;
}

interface Named {
  id: number;
  name: string;
  slug: string;
}

interface GameCard {
  id: number;
  cover?: Image | null;
  platforms?: unknown[];
  genres?: unknown[];
  gameTypeRef?: { id: number; type: string } | null;
  deletedAt?: Date | null;
  lastSyncedAt?: Date | null;
  igdbUpdatedAt?: Date | null;
  raw?: unknown;
  searchNames?: unknown;
  // Detail-only
  screenshots?: Image[];
  websites?: { websiteType?: { type: string } | null; [key: string]: unknown }[];
  similarGameIds?: number[];
}

interface GameDetailRelations {
  videos?: { id: number; name: string | null; videoId: string }[];
  externalGames?: {
    id: number;
    name: string | null;
    uid: string | null;
    url: string | null;
    source?: { id: number; name: string } | null;
  }[];
  collections?: Named[];
  themes?: Named[];
  gameModes?: Named[];
  companyRoles?: {
    developer: boolean;
    publisher: boolean;
    porting: boolean;
    supporting: boolean;
    company: Named;
  }[];
  localizations?: {
    id: number;
    name: string | null;
    regionId: number | null;
    coverHash: string | null;
    coverWidth: number | null;
    coverHeight: number | null;
  }[];
  timeToBeat?: {
    hastily: number | null;
    normally: number | null;
    completely: number | null;
    count: number | null;
  } | null;
}

export interface RelatedGame {
  id: number;
  name: string;
  slug: string;
  gameType: number | null;
  firstReleaseDate: number | null;
  cover?: Image | null;
}

const imageOut = (image: Image | null | undefined, size: IgdbImageSize) => ({
  id: image?.id,
  url: image?.hash ? getImageUrl(image.source, image.hash, size) : null,
  width: image?.width,
  height: image?.height,
});

/** Shape shared by every list and the detail: card fields, optional detail sections. */
export const transformGameResponse = <T extends GameCard>(game: T) => {
  const {
    cover,
    platforms,
    genres,
    gameTypeRef,
    screenshots,
    websites,
    similarGameIds,
    deletedAt,
    lastSyncedAt: _lastSyncedAt,
    igdbUpdatedAt: _igdbUpdatedAt,
    raw: _raw,
    searchNames: _searchNames,
    ...rest
  } = game;

  return {
    ...rest,
    deleted: !!deletedAt,
    platforms: platforms ?? [],
    genres: genres ?? [],
    // A game has one IGDB type; kept as a one-element array for the existing client shape
    types: gameTypeRef ? [gameTypeRef] : [],
    cover: imageOut(cover, IgdbImageSize.COVER_BIG),
    ...(screenshots && {
      screenshots: screenshots.map((screenshot) =>
        imageOut(screenshot, IgdbImageSize.SCREENSHOT_BIG),
      ),
    }),
    ...(websites && {
      websites: websites.map(({ websiteType, ...website }) => ({
        ...website,
        type: websiteType?.type ?? null,
      })),
    }),
    ...(similarGameIds && {
      similarGames: similarGameIds.map((id) => ({ id })),
    }),
  };
};

const relatedOut = (games: RelatedGame[]) =>
  games.map(({ cover, ...rest }) => ({ ...rest, cover: imageOut(cover, IgdbImageSize.COVER_BIG) }));

/** The detail view: everything the card has plus companies, media, links, series and relatives. */
export const transformGameDetail = <T extends GameCard & GameDetailRelations>(
  game: T,
  related: { children: RelatedGame[]; editions: RelatedGame[] },
) => {
  const {
    videos,
    externalGames,
    collections,
    themes,
    gameModes,
    companyRoles,
    localizations,
    timeToBeat,
    ...card
  } = game;

  const companiesWith = (role: "developer" | "publisher") =>
    (companyRoles ?? []).filter((r) => r[role]).map((r) => r.company);

  return {
    ...transformGameResponse(card),
    developers: companiesWith("developer"),
    publishers: companiesWith("publisher"),
    videos: (videos ?? []).map((video) => ({
      id: video.id,
      name: video.name,
      videoId: video.videoId,
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
    })),
    externalGames: (externalGames ?? []).map((eg) => ({
      id: eg.id,
      source: eg.source?.name ?? null,
      name: eg.name,
      uid: eg.uid,
      url: eg.url,
    })),
    collections: collections ?? [],
    themes: themes ?? [],
    gameModes: gameModes ?? [],
    timeToBeat: timeToBeat
      ? {
          hastily: timeToBeat.hastily,
          normally: timeToBeat.normally,
          completely: timeToBeat.completely,
          count: timeToBeat.count,
        }
      : null,
    localizedCovers: (localizations ?? [])
      .filter((loc) => loc.coverHash)
      .map((loc) => ({
        id: loc.id,
        name: loc.name,
        regionId: loc.regionId,
        url: getImageUrl("igdb", loc.coverHash!, IgdbImageSize.COVER_BIG),
        width: loc.coverWidth,
        height: loc.coverHeight,
      })),
    // DLC, expansions, updates, bundles that point at this game
    children: relatedOut(related.children),
    // Deluxe / GOTY / regional versions of this game
    editions: relatedOut(related.editions),
  };
};
