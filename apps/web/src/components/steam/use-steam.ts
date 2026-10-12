import {
  getGetApiUserByUsernameGamesQueryKey,
  getGetApiMeRecommendationsQueryKey,
  getGetApiUserByUsernameQueryKey,
  useDeleteApiMeSteam,
  usePostApiMeImportSteam,
} from "@playdamnit/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { t } from "@/i18n";

const apiMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
  t("steam.failed");

/** Import (or sync) the Steam library and unlink it, with one toast for the outcome */
export const useSteam = (username: string, onImported?: () => void) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameGamesQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiMeRecommendationsQueryKey() });
  };
  const run = usePostApiMeImportSteam({
    mutation: {
      onSuccess: (result) => {
        refresh();
        if (result.imported > 0) toast.success(t("steam.added", { count: result.imported }));
        else toast(t("steam.nothingNew"));
        onImported?.();
      },
      onError: (error) => toast.error(apiMessage(error)),
    },
  });
  const unlink = useDeleteApiMeSteam({ mutation: { onSuccess: refresh } });
  return {
    pending: run.isPending,
    /** With a profile: import it and link it. Without: sync the linked account. */
    importLibrary: (profile?: string) =>
      run.mutate({ data: profile ? { profile: profile.trim() } : {} }),
    unlink: () => unlink.mutate(),
  };
};
