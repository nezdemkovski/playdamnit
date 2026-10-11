import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  decimal,
  real,
  index,
  jsonb,
  primaryKey,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export enum GameTypeEnum {
  MAIN_GAME = 0,
  DLC = 1,
  EXPANSION = 2,
  BUNDLE = 3,
  STANDALONE_EXPANSION = 4,
  MOD = 5,
  EPISODE = 6,
  SEASON = 7,
  REMAKE = 8,
  REMASTER = 9,
  EXPANDED_GAME = 10,
  PORT = 11,
  FORK = 12,
  PACK = 13,
  UPDATE = 14,
}

export enum ImageSourceEnum {
  IGDB = "igdb",
  LOCAL = "local",
}

// ─── Better Auth Tables ───────────────────────────────────────────────────────
// Mirrors the schema Better Auth 1.7 (+ username, admin, passkey, api-key plugins) expects.

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_i_d").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);

export const apikey = pgTable(
  "apikey",
  {
    id: text("id").primaryKey(),
    configId: text("config_id").default("default").notNull(),
    name: text("name"),
    start: text("start"),
    // Owner of the key; with the default api-key config this is always a user id
    referenceId: text("reference_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    prefix: text("prefix"),
    key: text("key").notNull(),
    refillInterval: integer("refill_interval"),
    refillAmount: integer("refill_amount"),
    lastRefillAt: timestamp("last_refill_at"),
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true),
    rateLimitTimeWindow: integer("rate_limit_time_window").default(86400000),
    rateLimitMax: integer("rate_limit_max").default(10),
    requestCount: integer("request_count").default(0),
    remaining: integer("remaining"),
    lastRequest: timestamp("last_request"),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    permissions: text("permissions"),
    metadata: text("metadata"),
  },
  (table) => [
    index("apikey_configId_idx").on(table.configId),
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_key_idx").on(table.key),
  ],
);

export const USER_GAME_STATUSES = [
  "finished",
  "playing",
  "dropped",
  "online",
  "on_hold",
  "want_to_play",
  "backlog",
] as const;

export type UserGameStatus = (typeof USER_GAME_STATUSES)[number];

export const USER_GAME_SOURCES = ["steam", "gog", "manual"] as const;

export const userMetadata = pgTable("user_metadata", {
  id: uuid("id")
    .default(sql`uuidv7()`)
    .primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  bio: text("bio"),
});

export const userGames = pgTable(
  "user_games",
  {
    id: uuid("id")
      .default(sql`uuidv7()`)
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "restrict" }),
    status: text("status", { enum: USER_GAME_STATUSES }).notNull(),
    source: text("source", { enum: USER_GAME_SOURCES }).notNull().default("manual"),
    endedAt: timestamp("ended_at"),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    rating: decimal("rating", { precision: 3, scale: 1 }),
    review: text("review"),
    platformId: integer("platform_id").references(() => platform.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    unique("user_games_user_id_game_id_unique").on(table.userId, table.gameId),
    index("idx_user_games_game_id").on(table.gameId),
  ],
);

export const userFollows = pgTable(
  "user_follows",
  {
    id: uuid("id")
      .default(sql`uuidv7()`)
      .primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("user_follows_follower_id_following_id_unique").on(table.followerId, table.followingId),
    index("idx_user_follows_following_id").on(table.followingId),
    check("user_follows_no_self_follow", sql`${table.followerId} <> ${table.followingId}`),
  ],
);

// Queries already searched in IGDB, so a miss in the local catalog doesn't hit IGDB on every request
export const igdbSearchLog = pgTable("igdb_search_log", {
  query: text("query").primaryKey(),
  searchedAt: timestamp("searched_at").defaultNow().notNull(),
});

// ─── Game Catalog Tables ──────────────────────────────────────────────────────
// Every catalog table is a mirror of IGDB: primary keys are IGDB ids, never generated locally.

export const platform = pgTable(
  "platform",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    abbreviation: text("abbreviation"),
  },
  (table) => [index("idx_platform_slug").on(table.slug)],
);

export const genre = pgTable(
  "genre",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [index("idx_genre_slug").on(table.slug)],
);

export const gameMode = pgTable(
  "game_mode",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [index("idx_game_mode_slug").on(table.slug)],
);

export const theme = pgTable(
  "theme",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [index("idx_theme_slug").on(table.slug)],
);

// IGDB game types ("Main Game", "DLC", ...); ids match GameTypeEnum
export const type = pgTable(
  "type",
  {
    id: integer("id").primaryKey(),
    type: text("type").notNull().unique(),
  },
  (table) => [index("idx_type_type").on(table.type)],
);

export const websiteType = pgTable(
  "website_type",
  {
    id: integer("id").primaryKey(),
    type: text("type").notNull().unique(),
  },
  (table) => [index("idx_website_type_type").on(table.type)],
);

export const company = pgTable(
  "company",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [index("idx_company_slug").on(table.slug)],
);

// Series ("The Legend of Zelda", ...)
export const collection = pgTable(
  "collection",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [index("idx_collection_slug").on(table.slug)],
);

// Stores and services an external_game row points at (Steam, GOG, ...)
export const externalGameSource = pgTable("external_game_source", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});

export const game = pgTable(
  "game",
  {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    summary: text("summary"),
    storyline: text("storyline"),
    firstReleaseDate: integer("first_release_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    totalRating: real("total_rating"),
    involvedCompanies: text("involved_companies"),
    keywords: text("keywords"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    isPopular: boolean("is_popular").notNull().default(false),
    totalRatingCount: integer("total_rating_count"),
    // IGDB date precision for first_release_date ("YYYYMMMMDD", "YYYYMMMM", "YYYY", ...)
    firstReleaseDatePrecision: text("first_release_date_precision"),
    // IGDB game_type id (GameTypeEnum); single-valued, unlike the legacy game_to_type junction
    gameType: integer("game_type"),
    // DLC/expansions point at their parent; editions point at the game they are a version of
    parentGameId: integer("parent_game_id"),
    versionParentId: integer("version_parent_id"),
    alternativeNames: text("alternative_names")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // name + alternative names, written by the librarian; what search matches on
    searchNames: text("search_names"),
    // Similar games are plain IGDB ids: the target may not be in the catalog yet
    similarGameIds: integer("similar_game_ids")
      .array()
      .notNull()
      .default(sql`'{}'::integer[]`),
    // The expanded IGDB response as received; columns and child tables are derived from it
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    igdbUpdatedAt: timestamp("igdb_updated_at"),
    lastSyncedAt: timestamp("last_synced_at"),
    // Set when IGDB no longer returns the game; rows stay because libraries reference them
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("idx_game_name_trgm").using("gin", table.name.op("gin_trgm_ops")),
    index("idx_game_search_names_trgm").using("gin", table.searchNames.op("gin_trgm_ops")),
    index("idx_game_slug").on(table.slug),
    index("idx_game_popular").on(table.isPopular),
    index("idx_game_rating").on(table.totalRating),
    index("idx_game_type").on(table.gameType),
    index("idx_game_parent_game_id").on(table.parentGameId),
    index("idx_game_version_parent_id").on(table.versionParentId),
    index("idx_game_last_synced_at").on(table.lastSyncedAt),
  ],
);

export const cover = pgTable(
  "cover",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: integer("game_id")
      .notNull()
      .unique()
      .references(() => game.id, { onDelete: "cascade" }),
    hash: text("hash").notNull(),
    source: text("source", { enum: ["igdb", "local"] })
      .notNull()
      .default(ImageSourceEnum.IGDB),
    width: integer("width"),
    height: integer("height"),
  },
  (table) => [index("idx_cover_game_id").on(table.gameId)],
);

export const screenshot = pgTable(
  "screenshot",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    hash: text("hash").notNull(),
    source: text("source", { enum: ["igdb", "local"] })
      .notNull()
      .default(ImageSourceEnum.IGDB),
    width: integer("width"),
    height: integer("height"),
  },
  (table) => [index("idx_screenshot_game_id").on(table.gameId)],
);

export const website = pgTable(
  "website",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    trusted: boolean("trusted"),
    typeId: integer("type_id").references(() => websiteType.id),
  },
  (table) => [
    index("idx_website_game_id").on(table.gameId),
    index("idx_website_type_id").on(table.typeId),
  ],
);

export const gameToSimilarGame = pgTable(
  "game_to_similar_game",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    similarGameId: integer("similar_game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.similarGameId] }),
    index("idx_g2sg_game_id").on(table.gameId),
    index("idx_g2sg_similar_game_id").on(table.similarGameId),
  ],
);

export const gameToPlatform = pgTable(
  "game_to_platform",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platform.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.platformId] }),
    index("idx_g2p_game_id").on(table.gameId),
    index("idx_g2p_platform_id").on(table.platformId),
  ],
);

export const gameToGenre = pgTable(
  "game_to_genre",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genre.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.genreId] }),
    index("idx_g2g_game_id").on(table.gameId),
    index("idx_g2g_genre_id").on(table.genreId),
  ],
);

export const gameToGameMode = pgTable(
  "game_to_game_mode",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    gameModeId: integer("game_mode_id")
      .notNull()
      .references(() => gameMode.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.gameModeId] }),
    index("idx_g2gm_game_id").on(table.gameId),
    index("idx_g2gm_game_mode_id").on(table.gameModeId),
  ],
);

export const gameToType = pgTable(
  "game_to_type",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    typeId: integer("type_id")
      .notNull()
      .references(() => type.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.typeId] }),
    index("idx_g2t_game_id").on(table.gameId),
    index("idx_g2t_type_id").on(table.typeId),
  ],
);

export const gameToTheme = pgTable(
  "game_to_theme",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    themeId: integer("theme_id")
      .notNull()
      .references(() => theme.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.themeId] }),
    index("idx_g2th_game_id").on(table.gameId),
    index("idx_g2th_theme_id").on(table.themeId),
  ],
);

// IGDB involved_companies: one row per (game, company) with the roles the company had
export const gameToCompany = pgTable(
  "game_to_company",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    companyId: integer("company_id")
      .notNull()
      .references(() => company.id, { onDelete: "cascade" }),
    developer: boolean("developer").notNull().default(false),
    publisher: boolean("publisher").notNull().default(false),
    porting: boolean("porting").notNull().default(false),
    supporting: boolean("supporting").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.companyId] }),
    index("idx_g2c_game_id").on(table.gameId),
    index("idx_g2c_company_id").on(table.companyId),
  ],
);

export const gameToCollection = pgTable(
  "game_to_collection",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    collectionId: integer("collection_id")
      .notNull()
      .references(() => collection.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.collectionId] }),
    index("idx_g2col_game_id").on(table.gameId),
    index("idx_g2col_collection_id").on(table.collectionId),
  ],
);

// IGDB game_videos (YouTube ids)
export const video = pgTable(
  "video",
  {
    id: integer("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    name: text("name"),
    videoId: text("video_id").notNull(),
  },
  (table) => [index("idx_video_game_id").on(table.gameId)],
);

// IGDB external_games: the game's id/url in a store or service
export const externalGame = pgTable(
  "external_game",
  {
    id: integer("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    // external_game_source id; no FK so a new source doesn't block a game write
    sourceId: integer("source_id"),
    name: text("name"),
    uid: text("uid"),
    url: text("url"),
  },
  (table) => [
    index("idx_external_game_game_id").on(table.gameId),
    index("idx_external_game_source_id").on(table.sourceId),
  ],
);

// IGDB game_localizations: regional titles with their own cover
export const gameLocalization = pgTable(
  "game_localization",
  {
    id: integer("id").primaryKey(),
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    name: text("name"),
    regionId: integer("region_id"),
    coverHash: text("cover_hash"),
    coverWidth: integer("cover_width"),
    coverHeight: integer("cover_height"),
  },
  (table) => [index("idx_game_localization_game_id").on(table.gameId)],
);

// IGDB game_time_to_beats (seconds)
export const gameTimeToBeat = pgTable("game_time_to_beat", {
  gameId: integer("game_id")
    .primaryKey()
    .references(() => game.id, { onDelete: "cascade" }),
  hastily: integer("hastily"),
  normally: integer("normally"),
  completely: integer("completely"),
  count: integer("count"),
});

// ─── Catalog Sync ─────────────────────────────────────────────────────────────

// Checkpoints for the librarian's IGDB syncs (one row per entity / sync kind)
export const syncState = pgTable("sync_state", {
  entity: text("entity").primaryKey(),
  cursor: text("cursor"),
  lastRunAt: timestamp("last_run_at"),
});

// Games an IGDB webhook told us about; drained in batches by the librarian
export const catalogDirty = pgTable("catalog_dirty", {
  igdbId: integer("igdb_id").primaryKey(),
  reason: text("reason").notNull(),
  markedAt: timestamp("marked_at").defaultNow().notNull(),
});
