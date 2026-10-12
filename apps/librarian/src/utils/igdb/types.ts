// The expanded IGDB game document as returned by `GAME_FIELDS` (see utils.ts). Every
// relation we expand is an object (or array of objects); plain reference ids stay numbers.

export interface IGDBNamed {
  id: number;
  name: string;
  slug: string;
}

export interface IGDBTyped {
  id: number;
  type: string;
}

export interface IGDBImage {
  id: number;
  image_id: string;
  width?: number;
  height?: number;
}

export interface IGDBWebsite {
  id: number;
  type?: IGDBTyped;
  url: string;
  trusted?: boolean;
}

export interface IGDBVideo {
  id: number;
  name?: string;
  video_id: string;
}

export interface IGDBExternalGame {
  id: number;
  external_game_source?: number;
  name?: string;
  uid?: string;
  url?: string;
}

export interface IGDBInvolvedCompany {
  id: number;
  company: IGDBNamed;
  developer?: boolean;
  publisher?: boolean;
  porting?: boolean;
  supporting?: boolean;
}

export interface IGDBGameLocalization {
  id: number;
  name?: string;
  region?: number;
  cover?: IGDBImage;
}

export interface IGDBReleaseDate {
  id: number;
  date?: number;
  // date_formats table id: 0 = YYYYMMMMDD, 1 = YYYYMMMM, 2 = YYYY, 3-6 = quarters, 7 = TBD
  date_format?: number;
  platform?: number;
}

export interface IGDBGameResponse {
  id: number;
  name: string;
  slug: string;
  created_at?: number;
  updated_at?: number;
  first_release_date?: number;
  total_rating?: number;
  total_rating_count?: number;
  /** Follows before release; IGDB leaves the field out when it is zero */
  hypes?: number;
  summary?: string;
  storyline?: string;
  url?: string;
  game_type?: IGDBTyped;
  parent_game?: number;
  version_parent?: number;
  similar_games?: number[];
  alternative_names?: Array<{ id: number; name: string; comment?: string }>;
  cover?: IGDBImage;
  screenshots?: IGDBImage[];
  videos?: IGDBVideo[];
  websites?: IGDBWebsite[];
  external_games?: IGDBExternalGame[];
  involved_companies?: IGDBInvolvedCompany[];
  game_localizations?: IGDBGameLocalization[];
  release_dates?: IGDBReleaseDate[];
  genres?: IGDBNamed[];
  platforms?: Array<IGDBNamed & { abbreviation?: string }>;
  game_modes?: IGDBNamed[];
  themes?: IGDBNamed[];
  collections?: IGDBNamed[];
  keywords?: IGDBNamed[];
}
