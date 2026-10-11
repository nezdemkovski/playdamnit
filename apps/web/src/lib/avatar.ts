import { getConfig } from "@/config";

/** Uploaded avatars are served by the API at a relative path; external URLs pass through */
export const avatarSrc = (image: string | null | undefined): string | undefined => {
  if (!image) return undefined;
  return image.startsWith("/") ? `${getConfig().apiUrl}${image}` : image;
};

export const initialOf = (user: { username?: string | null; name?: string | null }) =>
  (user.username || user.name || "?").slice(0, 1).toUpperCase();
