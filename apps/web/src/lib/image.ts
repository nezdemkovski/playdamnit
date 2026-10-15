import { IgdbSize } from "./enums";

/** IGDB serves every size at double resolution under the same name plus this suffix */
const RETINA_SUFFIX = "_2x";

const withSize = (url: string, path: string) => url.replace(/\/t_[a-z0-9_]+\//, `/t_${path}/`);

// IGDB image URLs carry their size in the path (…/t_cover_big/<hash>.jpg); the API hands out
// cover_big for covers and screenshot_big for screenshots, the UI swaps in what it needs.
export const igdbImage = (url: string | null | undefined, size: IgdbSize): string | null => {
  if (!url) return null;
  return withSize(url, size);
};

/** `srcSet` with IGDB's retina variant, so 2x and 3x screens stay sharp */
export const igdbSrcSet = (url: string | null | undefined, size: IgdbSize): string | undefined => {
  if (!url) return undefined;
  return `${withSize(url, size)} 1x, ${withSize(url, size + RETINA_SUFFIX)} 2x`;
};

export const youtubeThumbnail = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;
