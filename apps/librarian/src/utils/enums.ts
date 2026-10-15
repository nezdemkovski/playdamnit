// Closed sets of string values used inside the librarian. Never write these as string literals.
// Values shared with the API (job modes, webhook entities, ...) live in `@playdamnit/db/*`.

export enum HttpMethod {
  Get = "GET",
  Post = "POST",
  Delete = "DELETE",
}

export enum HttpHeader {
  ClientId = "Client-ID",
  Authorization = "Authorization",
  ContentType = "Content-Type",
}

export enum MimeType {
  PlainText = "text/plain",
  FormUrlEncoded = "application/x-www-form-urlencoded",
}

export enum OAuthGrantType {
  ClientCredentials = "client_credentials",
}

/** pg-boss cron expressions */
export enum Schedule {
  DrainDirty = "* * * * *",
  SyncCatalog = "0 2 * * *",
  SyncLookups = "30 3 * * *",
  RefreshStaleGames = "0 4 * * *",
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

export enum LogLevel {
  Error = "error",
  Info = "info",
}

export enum LogDir {
  Default = "./logs",
}

export enum LogTimestampFormat {
  DateTime = "YYYY-MM-DD HH:mm:ss",
}

export enum LogNamespace {
  Librarian = "librarian",
  CatalogWriter = "catalog-writer",
  IgdbToken = "igdb-token",
  Igdb = "igdb",
  IgdbWebhooks = "igdb-webhooks",
  CatalogSync = "catalog-sync",
  DrainWorker = "drain-worker",
  IgdbWorker = "igdb-worker",
  LookupsWorker = "lookups-worker",
  RefreshWorker = "refresh-worker",
}

export enum LogSource {
  LibrarianStart = "librarian-start",
}

/** The service name logs and Sentry events carry; Sentry releases are `<service>@<version>` */
export enum ServiceName {
  Librarian = "playdamnit-librarian",
}

export enum NodeEnv {
  Development = "development",
  Production = "production",
}

export enum SentrySeverity {
  Error = "error",
}
