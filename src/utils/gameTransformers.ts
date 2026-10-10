import { getImageUrl, IgdbImageSize } from "@/utils/image";

// Relations loaded for list views (search, catalog, library). Heavy relations
// (screenshots, websites, similar games) are only loaded for the detail view.
export const GAME_CARD_WITH = {
  cover: true,
  platforms: true,
  genres: true,
  types: true,
} as const;

export const GAME_DETAIL_WITH = {
  ...GAME_CARD_WITH,
  screenshots: true,
  websites: true,
  similarGames: { columns: { id: true } },
} as const;

interface Image {
  id: number;
  hash: string;
  source: string;
  width: number | null;
  height: number | null;
}

interface GameWithRelations {
  id: number;
  cover?: Image | null;
  platforms?: unknown[];
  genres?: unknown[];
  types?: unknown[];
  screenshots?: Image[];
  websites?: unknown[];
  similarGames?: { id: number }[];
}

export const transformGameResponse = <T extends GameWithRelations>(game: T) => {
  const { cover, platforms, genres, types, screenshots, websites, similarGames, ...rest } =
    game;

  return {
    ...rest,
    platforms: platforms ?? [],
    genres: genres ?? [],
    types: types ?? [],
    cover: {
      id: cover?.id,
      url: cover?.hash
        ? getImageUrl(cover.source, cover.hash, IgdbImageSize.COVER_BIG)
        : null,
      width: cover?.width,
      height: cover?.height,
    },
    ...(screenshots && {
      screenshots: screenshots.map((screenshot) => ({
        id: screenshot.id,
        url: screenshot.hash
          ? getImageUrl(screenshot.source, screenshot.hash, IgdbImageSize.SCREENSHOT_BIG)
          : null,
        width: screenshot.width,
        height: screenshot.height,
      })),
    }),
    ...(websites && { websites }),
    ...(similarGames && {
      similarGames: similarGames.map(({ id }) => ({ id })),
    }),
  };
};
