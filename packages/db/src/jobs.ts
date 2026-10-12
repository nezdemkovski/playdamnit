// Contract between the backend and the librarian: pg-boss queues and the
// LISTEN/NOTIFY channel. Imported by both services, so keep it dependency-free.

export const QUEUES = {
  FETCH_BY_IDS: "fetch-by-ids",
  REFRESH_STALE_GAMES: "refresh-stale-games",
  // Mirror IGDB's lookup endpoints (platforms, genres, companies, ...) into the catalog
  SYNC_LOOKUPS: "sync-lookups",
  // Walk IGDB's games endpoint into the catalog, a page at a time, resumable
  SYNC_CATALOG: "sync-catalog",
  // Re-fetch the games IGDB webhooks marked in catalog_dirty
  DRAIN_DIRTY: "drain-dirty",
  // Bring new games from linked Steam libraries in (run by the API, which owns the import)
  STEAM_SYNC: "steam-sync",
} as const;

export const ALL_QUEUES = Object.values(QUEUES);

export const NOTIFY_CHANNEL = "game_catalog_updated";

export interface FetchByIdsJob {
  ids: number[];
  requestId?: string;
}

export interface SyncLookupsJob {
  force?: boolean;
}

export interface SyncCatalogCursor {
  // full: the last IGDB game id written
  id?: number;
  // incremental: IGDB `updated_at` (unix seconds) and the last id seen at that second
  updatedAt?: number;
  updatedAtId?: number;
  // when this walk started (unix seconds); seeds the incremental cursor when a full walk ends
  startedAt?: number;
}

/** full: walk /games by id; incremental: only what IGDB updated since the last walk */
export enum SyncMode {
  Full = "full",
  Incremental = "incremental",
}

export interface SyncCatalogJob {
  mode: SyncMode;
  cursor?: SyncCatalogCursor;
}

export interface CatalogUpdatedPayload {
  requestId: string;
  ok: boolean;
}
