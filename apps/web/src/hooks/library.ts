import {
  getGetApiHomeQueryKey,
  getGetApiGamesByIdQueryKey,
  getGetApiMeRecommendationsQueryKey,
  getGetApiUserByUsernameGamesByIdQueryKey,
  getGetApiUserByUsernameGamesIndexQueryKey,
  getGetApiUserByUsernameGamesQueryKey,
  useDeleteApiUserByUsernameGamesById,
  useGetApiUserByUsernameGamesById,
  useGetApiUserByUsernameGamesIndex,
  usePatchApiUserByUsernameGamesById,
  usePostApiUserByUsernameGames,
  usePostApiUserByUsernameGamesImport,
  type Game,
  type GameCommunity,
  type LibraryIndexItem,
  type LibraryIndexResponse,
  type PostApiUserByUsernameGamesImportBodyTwo,
  type UserGameCreateRequest,
  type UserGameUpdateRequest,
  type UserGameWithUserData,
} from "@playdamnit/api-client";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { t } from "@/i18n";
import { LibraryAction } from "@/lib/enums";
import { summarize, toastFor } from "@/lib/voice";
import { useSession } from "./auth";

const apiError = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/**
 * A user's whole library, light: every entry without its review text on a minimal game card.
 * Lookups, summaries, the profile header and the tier board all work from this.
 */
export const useLibraryIndex = (username: string | null | undefined) =>
  useGetApiUserByUsernameGamesIndex(username ?? "", {
    query: { enabled: !!username },
  });

/** The signed-in user's library, indexed by game id, for "is this in my list" lookups */
export const useMyLibrary = () => {
  const { user } = useSession();
  const username = user?.username ?? null;
  const query = useLibraryIndex(username);
  const byGameId = useMemo(() => {
    const map = new Map<number, LibraryIndexItem>();
    for (const entry of query.data?.results ?? []) map.set(entry.id, entry);
    return map;
  }, [query.data]);
  return { username, byGameId, entries: query.data?.results ?? [], isLoading: query.isPending };
};

/** One of the signed-in user's entries in full, review included (the index leaves it out) */
export const useMyEntry = (gameId: number, enabled: boolean) => {
  const { user } = useSession();
  const username = user?.username ?? "";
  return useGetApiUserByUsernameGamesById(username, gameId, {
    query: { enabled: enabled && !!username },
  });
};

/** Everything cached from a user's library (index, lists, single entries) is stale */
export const invalidateLibrary = (queryClient: QueryClient, username: string) => {
  // The keys are the URLs, so the list's URL is a prefix of the index's and every entry's
  const [prefix] = getGetApiUserByUsernameGamesQueryKey(username);
  queryClient.invalidateQueries({
    predicate: ({ queryKey: [head] }) => typeof head === "string" && head.startsWith(prefix),
  });
};

/** A full entry as the index serves it: the review reduced to whether there is one */
const toIndexItem = (entry: UserGameWithUserData): LibraryIndexItem => {
  const { review, ...data } = entry.userGameData;
  return {
    id: entry.id,
    name: entry.name,
    firstReleaseDate: entry.firstReleaseDate ?? null,
    cover: entry.cover?.url ?? null,
    userGameData: { ...data, endedAt: data.endedAt ?? null, hasReview: !!review },
  };
};

/** Add / update / remove entries of the signed-in user's library, refreshing every view of it */
export const useLibraryMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const username = user?.username ?? "";
  const { entries } = useMyLibrary();
  const voice = (kind: LibraryAction, status?: string) =>
    toastFor(kind, status, summarize(entries));

  const refresh = (gameId: number) => {
    invalidateLibrary(queryClient, username);
    queryClient.invalidateQueries({ queryKey: getGetApiGamesByIdQueryKey(gameId) });
    queryClient.invalidateQueries({ queryKey: getGetApiMeRecommendationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetApiHomeQueryKey() });
  };

  /**
   * Puts what a write answered into the cached index, the entry and the game page instead of
   * loading them again: the entry (or its removal) and the game's new member numbers. The paged
   * lists sort and filter on the server, so they reload. An answer without the entry or the
   * numbers (an older API) falls back to reloading everything.
   */
  const apply = (
    gameId: number,
    change: { entry?: UserGameWithUserData | null; removed?: boolean; community?: GameCommunity },
  ) => {
    if (!change.community || (!change.entry && !change.removed)) {
      refresh(gameId);
      return;
    }
    const { entry, community } = change;
    const item = entry ? toIndexItem(entry) : null;
    queryClient.setQueryData<LibraryIndexResponse>(
      getGetApiUserByUsernameGamesIndexQueryKey(username),
      (old) => {
        if (!old) return old;
        const known = old.results.some((e) => e.id === gameId);
        // An edit stays in place; a new entry goes first, as the index orders by when it was added
        const results = !item
          ? old.results.filter((e) => e.id !== gameId)
          : known
            ? old.results.map((e) => (e.id === gameId ? item : e))
            : [item, ...old.results];
        return { ...old, results };
      },
    );
    const entryKey = getGetApiUserByUsernameGamesByIdQueryKey(username, gameId);
    // A removed entry's copy is never read again (nothing asks for a game not in the list) and
    // a later add replaces it; marking it stale keeps an open dialog from asking for it again
    if (entry) queryClient.setQueryData(entryKey, entry);
    else queryClient.invalidateQueries({ queryKey: entryKey, refetchType: "none" });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameGamesQueryKey(username) });
    queryClient.setQueriesData<Game>({ queryKey: getGetApiGamesByIdQueryKey(gameId) }, (old) =>
      old ? { ...old, community } : old,
    );
    queryClient.invalidateQueries({ queryKey: getGetApiMeRecommendationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetApiHomeQueryKey() });
  };

  const add = usePostApiUserByUsernameGames({
    mutation: {
      onSuccess: (data, vars) => {
        apply(vars.data.gameId, data);
        toast.success(voice(LibraryAction.Add, vars.data.status));
      },
      onError: (error) => toast.error(apiError(error, t("toast.addGameFailed"))),
    },
  });

  const update = usePatchApiUserByUsernameGamesById({
    mutation: {
      onSuccess: (data, vars) => {
        apply(vars.id, data);
        toast.success(voice(LibraryAction.Update, vars.data.status));
      },
      onError: (error) => toast.error(apiError(error, t("toast.saveGameFailed"))),
    },
  });

  const remove = useDeleteApiUserByUsernameGamesById({
    mutation: {
      onSuccess: (data, vars) => {
        apply(vars.id, { removed: true, community: data.community });
        toast.success(voice(LibraryAction.Remove));
      },
      onError: (error) => toast.error(apiError(error, t("toast.removeGameFailed"))),
    },
  });

  const importGames = usePostApiUserByUsernameGamesImport({
    mutation: {
      onSuccess: (result) => {
        invalidateLibrary(queryClient, username);
        queryClient.invalidateQueries({ queryKey: getGetApiMeRecommendationsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetApiHomeQueryKey() });
        toast.success(
          t("toast.imported", {
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors,
          }),
        );
      },
      onError: (error) => toast.error(apiError(error, t("toast.importFailed"))),
    },
  });

  return {
    username,
    isPending: add.isPending || update.isPending || remove.isPending,
    add: (data: UserGameCreateRequest) => add.mutateAsync({ username, data }),
    update: (id: number, data: UserGameUpdateRequest) => update.mutateAsync({ username, id, data }),
    remove: (id: number) => remove.mutateAsync({ username, id }),
    // axios sends a FormData body as multipart; the generated type only names the fields
    importFile: (form: FormData) =>
      importGames.mutateAsync({
        username,
        data: form as unknown as PostApiUserByUsernameGamesImportBodyTwo,
      }),
    importPending: importGames.isPending,
  };
};
