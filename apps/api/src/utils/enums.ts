// Closed sets of string values used inside the API. Never write these as string literals.
// Values shared with the librarian (statuses, emojis, webhook entities, ...) live in
// `@playdamnit/db/enums`.

export enum NodeEnv {
  Development = "development",
  Production = "production",
  Test = "test",
}

export enum GameSort {
  Id = "id",
  Popular = "popular",
  Rating = "rating",
  Recent = "recent",
  Upcoming = "upcoming",
  Wanted = "wanted",
  Played = "played",
  Date = "date",
}

export enum UserSort {
  Games = "games",
  Followers = "followers",
  Newest = "newest",
}

/** How a library list is ordered; mirrors the web's and the app's sort menu */
export enum LibrarySort {
  /** Untouched backlog first, then stale "playing", finished games last */
  Shame = "shame",
  Added = "added",
  Grade = "grade",
  Hours = "hours",
  Name = "name",
  Release = "release",
}

export enum ReviewSort {
  Latest = "latest",
  Top = "top",
}

/** Which side of a follow a member list shows */
export enum ConnectionKind {
  Followers = "followers",
  Following = "following",
}

export enum JournalKind {
  Playthrough = "playthrough",
  Entry = "entry",
}

export enum ExportFormat {
  Json = "json",
  Csv = "csv",
}

export enum SearchSource {
  None = "none",
  Database = "database",
}

export enum ChatRole {
  User = "user",
  Assistant = "assistant",
}

/** Query and form values that mean "yes" */
export enum FlagValue {
  True = "true",
  One = "1",
}

export const isFlagSet = (value: unknown): boolean =>
  value === true || value === FlagValue.True || value === FlagValue.One;

export enum MimeType {
  Csv = "text/csv",
  Json = "application/json",
  FormUrlencoded = "application/x-www-form-urlencoded",
  Jpeg = "image/jpeg",
  Png = "image/png",
  Webp = "image/webp",
  Gif = "image/gif",
}

export enum FileExtension {
  Csv = ".csv",
}

export enum ContentDisposition {
  Attachment = "attachment",
}

export enum HttpHeader {
  ContentType = "content-type",
  ContentDisposition = "content-disposition",
  CacheControl = "cache-control",
  ETag = "etag",
  IfNoneMatch = "if-none-match",
  RetryAfter = "retry-after",
  Origin = "origin",
  Authorization = "Authorization",
  ContentTypeCanonical = "Content-Type",
  /** IGDB webhooks carry the shared secret here */
  Secret = "x-secret",
}

export enum CacheControl {
  Immutable = "public, max-age=31536000, immutable",
  /** Shared lookups (platforms, genres): an hour fresh, a day served stale while refreshing */
  Catalog = "public, max-age=3600, stale-while-revalidate=86400",
  /** Everything else: kept by the client only, and checked with the ETag before every reuse */
  Revalidate = "private, no-cache",
}

export enum UrlProtocol {
  Http = "http:",
  Https = "https:",
}

export enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Put = "PUT",
  Patch = "PATCH",
  Delete = "DELETE",
  Options = "OPTIONS",
}

export enum HealthStatus {
  Ok = "ok",
}

export enum RoutePath {
  Favicon = "/favicon.ico",
  Catalog = "/api/catalog",
}

export enum CsvChar {
  Comma = ",",
  Quote = '"',
  Newline = "\n",
  CarriageReturn = "\r",
}

/** TypeBox string formats */
export enum StringFormat {
  Uuid = "uuid",
}

export enum LogNamespace {
  App = "app",
  AiChat = "ai-chat",
  IgdbWebhook = "igdb-webhook",
  Cors = "cors",
  PgBoss = "pg-boss",
  PgNotify = "pg-notify",
  SteamSync = "steam-sync",
}

/** pg-boss cron schedules of the jobs the API runs itself */
export enum Schedule {
  // Every six hours, off the hour so it doesn't pile onto the librarian's crons
  SteamSync = "20 */6 * * *",
}

export enum LogTimestampFormat {
  DateTime = "YYYY-MM-DD HH:mm:ss",
}

export enum LogSource {
  AppSetup = "app-setup",
  Shutdown = "shutdown",
}

export enum Hostname {
  Localhost = "localhost",
}

export enum Origin {
  LocalhostHttp = "http://localhost",
  // Apple posts the web sign-in back from here
  Apple = "https://appleid.apple.com",
}

/** Better Auth's social provider ids */
export enum SocialProvider {
  Apple = "apple",
}

export enum OpenAiModel {
  Gpt4o = "gpt-4o",
}

export enum LogDir {
  Default = "./logs",
}

export enum LogRotation {
  MaxSize = "20m",
  MaxFiles = "14d",
}

export enum LogFileDatePattern {
  Daily = "YYYY-MM-DD",
}

export enum LogFileName {
  Error = "error-%DATE%.log",
  Combined = "combined-%DATE%.log",
  Info = "info-%DATE%.log",
}

export enum SentrySeverity {
  Error = "error",
  Warning = "warning",
  Info = "info",
}

/** IGDB external_game_source ids the API reads */
export enum ExternalGameSourceId {
  Steam = 1,
}

/** IGDB game_type ids worth recommending: whole games, not DLC, bundles, mods or episodes */
export enum RecommendableGameType {
  MainGame = 0,
  StandaloneExpansion = 4,
  Remake = 8,
  Remaster = 9,
  ExpandedGame = 10,
}

/** IGDB platform ids the API assigns on its own */
export enum PlatformId {
  Pc = 6,
}

/** Steam's OpenID 2.0 provider ("Sign in through Steam") */
export enum SteamOpenId {
  Endpoint = "https://steamcommunity.com/openid/login",
  Namespace = "http://specs.openid.net/auth/2.0",
  IdentifierSelect = "http://specs.openid.net/auth/2.0/identifier_select",
}

export enum OpenIdMode {
  CheckIdSetup = "checkid_setup",
  IdRes = "id_res",
  CheckAuthentication = "check_authentication",
}

/** How connecting Steam ended, handed back to the web app as `?steam=` */
export enum SteamConnectResult {
  Connected = "connected",
  Private = "private",
  Failed = "failed",
}

/** The verdict on a game, S down to F: a band of the 0–10 rating (see `utils/grade.ts`) */
export enum Grade {
  S = "S",
  A = "A",
  B = "B",
  C = "C",
  D = "D",
  F = "F",
}

/** Profile badges, earned from the library (see `UserService.findByUsername`) */
export enum BadgeId {
  First = "first",
  Collector = "collector",
  Hoarder = "hoarder",
  Finisher = "finisher",
  Closer = "closer",
  Critic = "critic",
  Writer = "writer",
  Completionist = "completionist",
  Year = "year",
}

/** What a member did on a day of the activity map */
export enum ActivityAction {
  Added = "added",
  Finished = "finished",
  Dropped = "dropped",
  Updated = "updated",
  Played = "played",
}

/** Why a username can't be had */
export enum UsernameProblem {
  TooShort = "tooShort",
  TooLong = "tooLong",
  Characters = "characters",
  Taken = "taken",
}

/**
 * Which idle line a library entry gets: the clients turn the kind and its days into a sentence
 * ("212 days untouched", "in progress"), the API decides which one applies
 */
export enum IdleKind {
  Finished = "finished",
  Dropped = "dropped",
  PlayingFine = "playingFine",
  PlayingStale = "playingStale",
  OnHold = "onHold",
  Online = "online",
  Today = "today",
  Untouched = "untouched",
  Wanted = "wanted",
}
