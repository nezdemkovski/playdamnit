// Contract between the backend and the librarian: pg-boss queues and the
// LISTEN/NOTIFY channel. Imported by both services, so keep it dependency-free.

export const QUEUES = {
  SEARCH_IGDB: "search-igdb",
  FETCH_BY_IDS: "fetch-by-ids",
  PROCESS_SIMILAR_GAMES: "process-similar-games",
  REFRESH_STALE_GAMES: "refresh-stale-games",
} as const;

export const ALL_QUEUES = Object.values(QUEUES);

export const NOTIFY_CHANNEL = "game_catalog_updated";

export interface SearchIgdbJob {
  query: string;
  limit: number;
  requestId: string;
}

export interface FetchByIdsJob {
  ids: number[];
  requestId?: string;
  // 0 = requested by a user; incremented on every similar-games hop
  depth?: number;
}

export interface ProcessSimilarGamesJob {
  gameId: number;
  similarGameIds: number[];
  depth: number;
}

export interface CatalogUpdatedPayload {
  requestId: string;
  ok: boolean;
}
