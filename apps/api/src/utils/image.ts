import { ImageSource } from "@playdamnit/db/enums";

export enum IgdbImageSize {
  COVER_SMALL = "cover_small", // 90x128
  COVER_BIG = "cover_big", // 264x374
  SCREENSHOT_MED = "screenshot_med", // 569x320
  SCREENSHOT_BIG = "screenshot_big", // 889x500
  SCREENSHOT_HUGE = "screenshot_huge", // 1280x720
  LOGO_MED = "logo_med", // 284x160
  THUMB = "thumb", // 90x90
  MICRO = "micro", // 35x35
  HD = "720p", // 1280x720
  FULL_HD = "1080p", // 1920x1080
}

const getIgdbImageUrl = (hash: string, size: IgdbImageSize): string =>
  `https://images.igdb.com/igdb/image/upload/t_${size}/${hash}.jpg`;

/** URL of a catalog image. Only IGDB-hosted images exist today. */
export const getImageUrl = (
  source: string,
  hash: string,
  size: IgdbImageSize = IgdbImageSize.COVER_BIG,
): string => {
  if (!hash || source !== ImageSource.Igdb) return "";
  return getIgdbImageUrl(hash, size);
};
