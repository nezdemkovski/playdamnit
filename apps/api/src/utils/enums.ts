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
  RetryAfter = "retry-after",
  Origin = "origin",
  Authorization = "Authorization",
  ContentTypeCanonical = "Content-Type",
  /** IGDB webhooks carry the shared secret here */
  Secret = "x-secret",
}

export enum CacheControl {
  Immutable = "public, max-age=31536000, immutable",
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

/** IGDB platform ids the API assigns on its own */
export enum PlatformId {
  Pc = 6,
}
