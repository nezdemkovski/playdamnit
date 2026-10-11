import {
  getGetApiGamesByIdQueryKey,
  getGetApiUserByUsernameGamesQueryKey,
  useDeleteApiUserByUsernameGamesById,
  useGetApiUserByUsernameGames,
  usePatchApiUserByUsernameGamesById,
  usePostApiUserByUsernameGames,
  usePostApiUserByUsernameGamesImport,
  type PostApiUserByUsernameGamesImportBodyTwo,
  type UserGameCreateRequest,
  type UserGameUpdateRequest,
  type UserGameWithUserData,
} from "@playdamnit/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";

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
  const voice = (kind: "add" | "update" | "remove", status?: string) =>
    toastFor(kind, status, summarize(entries));

  const refresh = (gameId: number) => {
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameGamesQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiGamesByIdQueryKey(gameId) });
  };

  const add = usePostApiUserByUsernameGames({
    mutation: {
      onSuccess: (_data, vars) => {
        refresh(vars.data.gameId);
        toast.success(voice("add", vars.data.status));
      },
      onError: (error) => toast.error(apiError(error, "Could not add the game")),
    },
  });

  const update = usePatchApiUserByUsernameGamesById({
    mutation: {
      onSuccess: (_data, vars) => {
        refresh(vars.id);
        toast.success(voice("update", vars.data.status));
      },
      onError: (error) => toast.error(apiError(error, "Could not save the changes")),
    },
  });

  const remove = useDeleteApiUserByUsernameGamesById({
    mutation: {
      onSuccess: (_data, vars) => {
        refresh(vars.id);
        toast.success(voice("remove"));
      },
      onError: (error) => toast.error(apiError(error, "Could not remove the game")),
    },
  });

  const importGames = usePostApiUserByUsernameGamesImport({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({
          queryKey: getGetApiUserByUsernameGamesQueryKey(username),
        });
        toast.success(
          `Imported ${result.imported}, skipped ${result.skipped}, failed ${result.errors}. The backlog just grew.`,
        );
      },
      onError: (error) => toast.error(apiError(error, "Import failed")),
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
