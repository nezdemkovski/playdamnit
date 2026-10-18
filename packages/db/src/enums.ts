// Closed sets of string values shared by the API and the librarian. Use these instead of
// string literals; `enumValues` feeds Drizzle's `text(..., { enum })` and TypeBox unions.

/** The values of a string enum as a non-empty tuple, the shape Drizzle's `enum` option wants */
export const enumValues = <E extends Record<string, string>>(e: E) =>
  Object.values(e) as [E[keyof E], ...E[keyof E][]];

export enum UserGameStatus {
  Finished = "finished",
  Playing = "playing",
  Dropped = "dropped",
  Online = "online",
  OnHold = "on_hold",
  WantToPlay = "want_to_play",
  Backlog = "backlog",
}

export enum UserGameSource {
  Steam = "steam",
  Gog = "gog",
  Manual = "manual",
}

export enum NotificationType {
  Follow = "follow",
  ReviewReaction = "review_reaction",
}

export enum ReactionEmoji {
  Heart = "❤️",
  Fire = "🔥",
  Clap = "👏",
  Laugh = "😂",
  Thinking = "🤔",
  Sad = "😢",
  Skull = "💀",
  Eyes = "👀",
}

/** Where a cover or screenshot file lives */
export enum ImageSource {
  Igdb = "igdb",
  Local = "local",
}

/** IGDB entities whose webhooks re-fetch a game (also the receiver's `:entity` path segment) */
export enum WebhookEntity {
  Games = "games",
  Covers = "covers",
  Screenshots = "screenshots",
  Videos = "videos",
  Websites = "websites",
  ExternalGames = "external_games",
  GameLocalizations = "game_localizations",
  InvolvedCompanies = "involved_companies",
}

export enum WebhookMethod {
  Create = "create",
  Update = "update",
  Delete = "delete",
}

/** Who a company row is to a game */
export enum CompanyRole {
  Developer = "developer",
  Publisher = "publisher",
}

/** How precise an IGDB first release date is */
export enum ReleaseDatePrecision {
  Day = "day",
  Month = "month",
  Year = "year",
  Quarter = "quarter",
  Tbd = "tbd",
}

/** Postgres SQLSTATE codes the services react to */
export enum PgErrorCode {
  UniqueViolation = "23505",
}

/** Public contributions that can be reported. */
export enum ContentKind {
  User = "user",
  Review = "review",
  List = "list",
}
export enum ReportReason {
  Abuse = "abuse",
  Hate = "hate",
  Sexual = "sexual",
  Spam = "spam",
  Other = "other",
}
export enum ReportStatus {
  Pending = "pending",
  Dismissed = "dismissed",
  Removed = "removed",
  Banned = "banned",
}

export enum MemberRole {
  User = "user",
  Admin = "admin",
}
