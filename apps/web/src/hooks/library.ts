import {
  getGetApiHomeQueryKey,
  getGetApiGamesByIdQueryKey,
  getGetApiMeRecommendationsQueryKey,
  getGetApiUserByUsernameGamesQueryKey,
  useDeleteApiUserByUsernameGamesById,
  useGetApiUserByUsernameGames,
  usePatchApiUserByUsernameGamesById,
  usePostApiUserByUsernameGames,
  usePostApiUserByUsernameGamesImport,
  type Game,
  type GameCommunity,
  type PostApiUserByUsernameGamesImportBodyTwo,
  type UserGameResponse,
  type UserGameCreateRequest,
  type UserGameUpdateRequest,
  type UserGameWithUserData,
} from "@playdamnit/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

import { t } from "@/i18n";
import { LibraryAction } from "@/lib/enums";
import { summarize, toastFor } from "@/lib/voice";
import { useSession } from "./auth";

const apiError = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

/** A user's whole library (the API returns it in one page when no limit is given) */
export const useLibrary = (username: string | null | undefined) =>
  useGetApiUserByUsernameGames(username ?? "", undefined, {
    query: { enabled: !!username },
  });

/** The signed-in user's library, indexed by game id, for "is this in my list" lookups */
export const useMyLibrary = () => {
  const { user } = useSession();
  const username = user?.username ?? null;
  const query = useLibrary(username);
  const byGameId = useMemo(() => {
    const map = new Map<number, UserGameWithUserData>();
    for (const entry of query.data?.results ?? []) map.set(entry.id, entry);
    return map;
  }, [query.data]);
  return { username, byGameId, entries: query.data?.results ?? [], isLoading: query.isPending };
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
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameGamesQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiGamesByIdQueryKey(gameId) });
    queryClient.invalidateQueries({ queryKey: getGetApiMeRecommendationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetApiHomeQueryKey() });
  };

  /**
   * Puts what a write answered into the cached library and game page instead of loading both
   * again: the entry (or its removal) and the game's new member numbers. An answer without them
   * (an older API) falls back to reloading.
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
    queryClient.setQueriesData<UserGameResponse>(
      { queryKey: getGetApiUserByUsernameGamesQueryKey(username) },
      (old) => {
        if (!old) return old;
        const known = old.results.some((e) => e.id === gameId);
        // An edit stays in place; a new entry goes first, as the list orders by when it was added
        const results = !entry
          ? old.results.filter((e) => e.id !== gameId)
          : known
            ? old.results.map((e) => (e.id === gameId ? entry : e))
            : [entry, ...old.results];
        return { ...old, results, meta: { ...old.meta, total: results.length } };
      },
    );
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
        queryClient.invalidateQueries({
          queryKey: getGetApiUserByUsernameGamesQueryKey(username),
        });
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
