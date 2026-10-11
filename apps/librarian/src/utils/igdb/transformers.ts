import type { IGDBGameResponse } from "./types";

// Games rated by at least this many IGDB users count as popular (used for search ranking)
const POPULAR_RATING_COUNT = 100;

export const transformIGDBResponse = (game: IGDBGameResponse) => {
  const {
    cover,
    screenshots,
    first_release_date,
    created_at,
    websites,
    keywords,
    involved_companies,
    game_type,
    total_rating_count,
    ...restGame
  } = game;

  return {
    ...restGame,
    first_release_date,
    created_at,
    cover: cover && {
      id: cover.id,
      hash: cover.image_id,
      width: cover.width,
      height: cover.height,
    },
    screenshots: screenshots?.map(({ id, image_id, width, height }) => ({
      id,
      hash: image_id,
      width,
      height,
    })),
    websites: websites?.map(({ id, type, url, trusted }) => ({
      id,
      // Website types are a lookup table keyed by IGDB id
      type: type ? { id: type.id, type: type.type } : null,
      url,
      trusted,
    })),
    keywords: keywords?.map((keyword) => keyword.name).join(", "),
    involved_companies: involved_companies?.map((company) => company.company.name).join(", "),
    game_type: game_type && { id: game_type.id, type: game_type.type },
    total_rating_count,
    isPopular: (total_rating_count ?? 0) >= POPULAR_RATING_COUNT,
  };
};
