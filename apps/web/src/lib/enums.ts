// Closed sets of string values used by the web app. Never write these as string literals.
// Values that come from the API (statuses, sorts, notification types, emojis, ...) are enums
// generated into `@playdamnit/api-client`; these are the ones only the UI knows about.

/** The "everything" choice of a filter select or tab */
export enum AllOption {
  All = "all",
}

export enum LibraryView {
  List = "list",
  Grid = "grid",
}

export enum ChartTab {
  Popular = "popular",
  Best = "best",
  Wanted = "wanted",
  Played = "played",
  Upcoming = "upcoming",
}

export enum FriendsTab {
  Followers = "followers",
  Following = "following",
}

export enum ProfileTab {
  Profile = "profile",
  Games = "games",
  Journal = "journal",
  Reviews = "reviews",
  Lists = "lists",
  Friends = "friends",
  Likes = "likes",
}

export enum SettingsTab {
  Profile = "profile",
  Account = "account",
  Passkeys = "passkeys",
  Data = "data",
}

/** What a library write did, for the toast copy */
export enum LibraryAction {
  Add = "add",
  Update = "update",
  Remove = "remove",
}

/** What a day cell of the activity map shows */
/** What happened on a day of the activity map, in tooltip order */
export enum DayAction {
  Played = "played",
  Finished = "finished",
  Dropped = "dropped",
  Added = "added",
  Updated = "updated",
}

/** Which sentence the rating histogram tooltip uses */
export enum HistogramNoun {
  Games = "games",
  Ratings = "ratings",
}

export enum StatTone {
  Bad = "bad",
}

export enum StorageKey {
  LibraryView = "library-view",
}

export enum QueryKey {
  Session = "session",
  Passkeys = "passkeys",
  Users = "/api/users",
  Feed = "/api/me/feed",
}

export enum Hotkey {
  Search = "k",
}

export enum UploadMimeType {
  Jpeg = "image/jpeg",
}

export enum UploadFileName {
  Avatar = "avatar.jpg",
}

export enum ImageLoading {
  Lazy = "lazy",
  Eager = "eager",
}

/** Sizes IGDB serves, swapped into the image URL (see lib/image.ts) */
export enum IgdbSize {
  CoverSmall = "cover_small",
  CoverBig = "cover_big",
  ScreenshotMed = "screenshot_med",
  ScreenshotBig = "screenshot_big",
  ScreenshotHuge = "screenshot_huge",
  P720 = "720p",
  P1080 = "1080p",
  Thumb = "thumb",
}

export enum PillSize {
  Sm = "sm",
  Md = "md",
  Lg = "lg",
  Xl = "xl",
}

/** The AI SDK's chat protocol values the assistant dialog reacts to */
export enum ChatStatus {
  Submitted = "submitted",
  Streaming = "streaming",
}

export enum ChatPartType {
  Text = "text",
  SearchGames = "tool-search_games",
}

export enum ToolState {
  OutputAvailable = "output-available",
}

/** date-fns patterns, the only ones the app formats with */
export enum DateFormat {
  IsoDay = "yyyy-MM-dd",
  IsoMonth = "yyyy-MM",
  MonthDay = "MMM d",
  MonthShort = "MMM",
  MonthYearShort = "MMM yyyy",
  MonthYear = "MMMM yyyy",
  MonthDayLong = "MMMM d",
  MonthDayYearShort = "MMM d, yyyy",
  MonthDayYear = "MMMM d, yyyy",
  WeekdayShort = "EEE",
  WeekdayMonthDay = "EEEE, MMMM d",
  DayOfMonth = "d",
}

/** Rows of the activity map, Monday first */
export enum Weekday {
  Mon = "Mon",
  Tue = "Tue",
  Wed = "Wed",
  Thu = "Thu",
  Fri = "Fri",
  Sat = "Sat",
  Sun = "Sun",
}

/** First path segment of the app's sections, for "is this nav item active" checks */
export enum RoutePath {
  Calendar = "/calendar",
  Charts = "/charts",
  Community = "/community",
}

export enum Char {
  At = "@",
  Slash = "/",
}

/** Suffix of the generated API client's review query keys */
export enum QueryKeySuffix {
  Reviews = "/reviews",
}

/** Marks the query key of a list loaded page by page, apart from the one-page query */
export enum QueryKeyPart {
  Paged = "paged",
}

/** Browser drag-and-drop payload format. */
export enum DragDataType {
  Text = "text/plain",
}

/** Custom slide types of the media lightbox (images use the library's own "image") */
export enum MediaSlideType {
  Youtube = "youtube",
}

/** The value the API reads as "yes" in a query flag (e.g. popular=1) */
export enum FlagValue {
  One = "1",
}

/** How connecting Steam ended, as the API reports it back in `?steam=` */
export enum SteamConnectResult {
  Connected = "connected",
  Private = "private",
  Failed = "failed",
}

/** Kinds of change in the changelog, in display order */
export enum ChangeKind {
  New = "new",
  Changed = "changed",
  Fixed = "fixed",
}

/** Public documents, available without a session. */
export enum LegalDocument {
  Privacy = "privacy",
  Terms = "terms",
  Support = "support",
}
