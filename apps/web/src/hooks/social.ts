import {
  getGetApiGamesByIdListsQueryKey,
  getGetApiGamesByIdQueryKey,
  getGetApiGamesByIdReviewsQueryKey,
  getGetApiListsByIdQueryKey,
  getGetApiMeNotificationsQueryKey,
  getGetApiReviewsQueryKey,
  getGetApiUserByUsernameFollowersQueryKey,
  getGetApiUserByUsernameFollowingQueryKey,
  getGetApiUserByUsernameGamesByIdPlaythroughsQueryKey,
  getGetApiUserByUsernameJournalQueryKey,
  getGetApiUserByUsernameLikesQueryKey,
  getGetApiUserByUsernameListsQueryKey,
  getGetApiUserByUsernameQueryKey,
  getGetApiUserByUsernameReviewsQueryKey,
  getGetApiUsersQueryKey,
  useDeleteApiGamesByIdLike,
  useDeleteApiListsById,
  useDeleteApiListsByIdGamesByGameId,
  useDeleteApiMeAvatar,
  useDeleteApiReviewsByIdLike,
  useDeleteApiUserByUsernameFollow,
  useDeleteApiUserByUsernameGamesByIdPlaythroughsByPlaythroughId,
  useGetApiMeNotifications,
  usePatchApiListsById,
  usePatchApiMe,
  usePatchApiUserByUsernameGamesByIdPlaythroughsByPlaythroughId,
  usePostApiGamesByIdLike,
  usePostApiListsByIdGames,
  usePostApiMeAvatar,
  usePostApiMeNotificationsRead,
  usePostApiReviewsByIdLike,
  usePostApiUserByUsernameFollow,
  usePostApiUserByUsernameGamesByIdPlaythroughs,
  usePostApiUserByUsernameLists,
  usePutApiListsByIdGames,
  type GameListInput,
  type PlaythroughInput,
  type ProfileUpdateRequest,
} from "@playdamnit/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useSession } from "./auth";

const apiError = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const onError = (fallback: string) => (error: unknown) => toast.error(apiError(error, fallback));

/** Follow / unfollow with every view of that user refreshed */
export const useFollow = (username: string) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameFollowersQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameFollowingQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiUsersQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/me/feed"] });
  };
  const follow = usePostApiUserByUsernameFollow({
    mutation: { onSuccess: refresh, onError: onError("Could not follow") },
  });
  const unfollow = useDeleteApiUserByUsernameFollow({
    mutation: { onSuccess: refresh, onError: onError("Could not unfollow") },
  });
  return {
    isPending: follow.isPending || unfollow.isPending,
    follow: () => follow.mutate({ username }),
    unfollow: () => unfollow.mutate({ username }),
  };
};

export const useGameLike = (gameId: number) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetApiGamesByIdQueryKey(gameId) });
    if (user?.username) {
      queryClient.invalidateQueries({
        queryKey: getGetApiUserByUsernameLikesQueryKey(user.username),
      });
    }
  };
  const like = usePostApiGamesByIdLike({
    mutation: { onSuccess: refresh, onError: onError("Could not like") },
  });
  const unlike = useDeleteApiGamesByIdLike({
    mutation: { onSuccess: refresh, onError: onError("Could not unlike") },
  });
  return {
    isPending: like.isPending || unlike.isPending,
    toggle: (liked: boolean) =>
      liked ? unlike.mutate({ id: gameId }) : like.mutate({ id: gameId }),
  };
};

/** Like / unlike a review; every list that may show it is refreshed */
export const useReviewLike = () => {
  const queryClient = useQueryClient();
  const refresh = (gameId: number) => {
    queryClient.invalidateQueries({ queryKey: getGetApiGamesByIdReviewsQueryKey(gameId) });
    queryClient.invalidateQueries({ queryKey: getGetApiReviewsQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).endsWith("/reviews") });
  };
  const like = usePostApiReviewsByIdLike({ mutation: { onError: onError("Could not like") } });
  const unlike = useDeleteApiReviewsByIdLike({
    mutation: { onError: onError("Could not unlike") },
  });
  return {
    toggle: (reviewId: string, gameId: number, liked: boolean) =>
      (liked ? unlike : like).mutate({ id: reviewId }, { onSuccess: () => refresh(gameId) }),
  };
};

export const useProfileUpdate = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["session"] });
    if (user?.username)
      queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameQueryKey(user.username) });
  };
  const patch = usePatchApiMe({
    mutation: {
      onSuccess: () => {
        refresh();
        toast.success("Profile saved");
      },
      onError: onError("Could not save the profile"),
    },
  });
  const upload = usePostApiMeAvatar({
    mutation: {
      onSuccess: () => {
        refresh();
        toast.success("Avatar updated");
      },
      onError: onError("Could not upload the avatar"),
    },
  });
  const clear = useDeleteApiMeAvatar({
    mutation: { onSuccess: refresh, onError: onError("Could not remove the avatar") },
  });
  return {
    save: (data: ProfileUpdateRequest) => patch.mutateAsync({ data }),
    uploadAvatar: (file: File) => upload.mutateAsync({ data: { file } }),
    clearAvatar: () => clear.mutateAsync(),
    isPending: patch.isPending || upload.isPending || clear.isPending,
  };
};

export const useNotifications = (enabled: boolean) => {
  const queryClient = useQueryClient();
  const query = useGetApiMeNotifications(undefined, {
    query: { enabled, refetchInterval: 60_000 },
  });
  const read = usePostApiMeNotificationsRead({
    mutation: {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: getGetApiMeNotificationsQueryKey() }),
    },
  });
  return { ...query, unread: query.data?.unread ?? 0, markRead: () => read.mutate() };
};

export const useListMutations = () => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const username = user?.username ?? "";
  const refresh = (listId?: string, gameId?: number) => {
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameListsQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameQueryKey(username) });
    if (listId) queryClient.invalidateQueries({ queryKey: getGetApiListsByIdQueryKey(listId) });
    if (gameId) {
      queryClient.invalidateQueries({ queryKey: getGetApiGamesByIdListsQueryKey(gameId) });
      queryClient.invalidateQueries({ queryKey: getGetApiGamesByIdQueryKey(gameId) });
    }
  };
  const create = usePostApiUserByUsernameLists({
    mutation: { onSuccess: () => refresh(), onError: onError("Could not create the list") },
  });
  const update = usePatchApiListsById({
    mutation: { onSuccess: (_d, v) => refresh(v.id), onError: onError("Could not save the list") },
  });
  const remove = useDeleteApiListsById({
    mutation: {
      onSuccess: () => {
        refresh();
        toast.success("List deleted");
      },
      onError: onError("Could not delete the list"),
    },
  });
  const setGames = usePutApiListsByIdGames({
    mutation: { onSuccess: (_d, v) => refresh(v.id), onError: onError("Could not save the list") },
  });
  const addGame = usePostApiListsByIdGames({
    mutation: {
      onSuccess: (_d, v) => refresh(v.id, v.data.gameId),
      onError: onError("Could not add the game"),
    },
  });
  const removeGame = useDeleteApiListsByIdGamesByGameId({
    mutation: {
      onSuccess: (_d, v) => refresh(v.id, v.gameId),
      onError: onError("Could not remove the game"),
    },
  });
  return {
    isPending: create.isPending || update.isPending || remove.isPending || setGames.isPending,
    create: (data: GameListInput) => create.mutateAsync({ username, data }),
    update: (id: string, data: GameListInput) => update.mutateAsync({ id, data }),
    remove: (id: string) => remove.mutateAsync({ id }),
    setGames: (id: string, gameIds: number[]) => setGames.mutateAsync({ id, data: { gameIds } }),
    addGame: (id: string, gameId: number) => addGame.mutateAsync({ id, data: { gameId } }),
    removeGame: (id: string, gameId: number) => removeGame.mutateAsync({ id, gameId }),
  };
};

export const usePlaythroughMutations = (gameId: number) => {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const username = user?.username ?? "";
  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: getGetApiUserByUsernameGamesByIdPlaythroughsQueryKey(username, gameId),
    });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameJournalQueryKey(username) });
  };
  const add = usePostApiUserByUsernameGamesByIdPlaythroughs({
    mutation: { onSuccess: refresh, onError: onError("Could not log the playthrough") },
  });
  const update = usePatchApiUserByUsernameGamesByIdPlaythroughsByPlaythroughId({
    mutation: { onSuccess: refresh, onError: onError("Could not save the playthrough") },
  });
  const remove = useDeleteApiUserByUsernameGamesByIdPlaythroughsByPlaythroughId({
    mutation: { onSuccess: refresh, onError: onError("Could not delete the playthrough") },
  });
  return {
    isPending: add.isPending || update.isPending || remove.isPending,
    add: (data: PlaythroughInput) => add.mutateAsync({ username, id: gameId, data }),
    update: (playthroughId: string, data: PlaythroughInput) =>
      update.mutateAsync({ username, id: gameId, playthroughId, data }),
    remove: (playthroughId: string) => remove.mutateAsync({ username, id: gameId, playthroughId }),
  };
};
