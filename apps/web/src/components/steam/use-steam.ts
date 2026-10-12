import {
  getGetApiHomeQueryKey,
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

/** Sync the linked Steam library and unlink it, with one toast for the outcome */
export const useSteam = (username: string) => {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameGamesQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiMeRecommendationsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetApiHomeQueryKey() });
  };
  const run = usePostApiMeImportSteam({
    mutation: {
      onSuccess: (result) => {
        refresh();
        if (result.imported > 0) toast.success(t("steam.added", { count: result.imported }));
        else toast(t("steam.nothingNew"));
      },
      onError: (error) => toast.error(apiMessage(error)),
    },
  });
  const unlink = useDeleteApiMeSteam({ mutation: { onSuccess: refresh } });
  return {
    pending: run.isPending,
    /** Sync the linked account now */
    importLibrary: () => run.mutate({ data: {} }),
    unlink: () => unlink.mutate(),
  };
};
