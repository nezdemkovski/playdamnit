import { useGetApiUserByUsername } from "@playdamnit/api-client";
import { useParams } from "@tanstack/react-router";

import { useSession } from "./auth";
import { useLibrary } from "./library";

/** The profile and library of the user in the URL, plus whether the viewer owns it */
export const useProfileContext = () => {
  const { username } = useParams({ strict: false }) as { username: string };
  const { user: viewer } = useSession();
  const profile = useGetApiUserByUsername(username);
  const library = useLibrary(username);
  const isOwn = !!viewer?.username && viewer.username.toLowerCase() === username.toLowerCase();
  const isPrivate =
    (library.error as { response?: { status?: number } } | null)?.response?.status === 403;
  return { username, profile, library, entries: library.data?.results ?? [], isOwn, isPrivate };
};
