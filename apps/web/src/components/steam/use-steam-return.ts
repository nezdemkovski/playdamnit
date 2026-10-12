import {
  getGetApiMeRecommendationsQueryKey,
  getGetApiUserByUsernameGamesQueryKey,
  getGetApiUserByUsernameQueryKey,
} from "@playdamnit/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { SteamConnectResult } from "@/lib/enums";

// The API hands the outcome back on the page that started it as ?steam=<result>
export const STEAM_RESULT_PARAM = "steam";

/** Back from Steam: one toast for the outcome, fresh profile data, and the parameter gone */
export function useSteamReturn(username: string | undefined) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get(STEAM_RESULT_PARAM);
    if (!result || !username) return;
    url.searchParams.delete(STEAM_RESULT_PARAM);
    window.history.replaceState(window.history.state, "", url.toString());
    if (result === SteamConnectResult.Connected) toast.success(t("steam.connected"));
    else if (result === SteamConnectResult.Private) toast.error(t("steam.private"));
    else toast.error(t("steam.connectFailed"));
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameGamesQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiMeRecommendationsQueryKey() });
  }, [username, queryClient, t]);
}
