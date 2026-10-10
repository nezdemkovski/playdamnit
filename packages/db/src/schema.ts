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
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  bio: text("bio"),
});

export const userGames = pgTable(
  "user_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
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
    id: uuid("id").defaultRandom().primaryKey(),
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

export const platform = pgTable(
  "platform",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [index("idx_platform_slug").on(table.slug)],
);

export const genre = pgTable(
  "genre",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [index("idx_genre_slug").on(table.slug)],
);

export const gameMode = pgTable(
  "game_mode",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
  },
  (table) => [index("idx_game_mode_slug").on(table.slug)],
);

export const type = pgTable(
  "type",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: text("type").notNull().unique(),
  },
  (table) => [index("idx_type_type").on(table.type)],
);

export const websiteType = pgTable(
  "website_type",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    type: text("type").notNull().unique(),
  },
  (table) => [index("idx_website_type_type").on(table.type)],
);

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
  },
  (table) => [
    index("idx_game_name_trgm").using("gin", table.name.op("gin_trgm_ops")),
    index("idx_game_slug").on(table.slug),
    index("idx_game_popular").on(table.isPopular),
    index("idx_game_rating").on(table.totalRating),
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
