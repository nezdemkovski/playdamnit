// IGDB image URLs carry their size in the path (…/t_cover_big/<hash>.jpg); the API hands out
// cover_big for covers and screenshot_big for screenshots, the UI swaps in what it needs.
export type IgdbSize =
  | "cover_small"
  | "cover_big"
  | "screenshot_med"
  | "screenshot_big"
  | "screenshot_huge"
  | "720p"
  | "1080p"
  | "thumb";

export const igdbImage = (url: string | null | undefined, size: IgdbSize): string | null => {
  if (!url) return null;
  return url.replace(/\/t_[a-z0-9_]+\//, `/t_${size}/`);
};

export const youtubeThumbnail = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
