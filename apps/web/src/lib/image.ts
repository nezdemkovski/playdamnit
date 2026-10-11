import { IgdbSize } from "./enums";

// IGDB image URLs carry their size in the path (…/t_cover_big/<hash>.jpg); the API hands out
// cover_big for covers and screenshot_big for screenshots, the UI swaps in what it needs.
export const igdbImage = (url: string | null | undefined, size: IgdbSize): string | null => {
  if (!url) return null;
  return url.replace(/\/t_[a-z0-9_]+\//, `/t_${size}/`);
};

export const youtubeThumbnail = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
