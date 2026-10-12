import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { getConfig } from "@/config";
import { SteamLogo } from "./steam-logo";

import { STEAM_RESULT_PARAM } from "./use-steam-return";

/** Sign in through Steam: the API sends the browser to Steam and back to this page */
const connectSteam = () => {
  const back = new URL(window.location.href);
  back.searchParams.delete(STEAM_RESULT_PARAM);
  const url = new URL("/api/me/steam/connect", getConfig().apiUrl);
  url.searchParams.set("returnTo", back.toString());
  window.location.assign(url.toString());
};

export function SteamConnectButton({
  size,
  variant = "outline",
}: {
  size?: "sm" | "default";
  variant?: "outline" | "default";
}) {
  const { t } = useTranslation();
  return (
    <Button variant={variant} size={size} onClick={connectSteam}>
      <SteamLogo /> {t("steam.connect")}
    </Button>
  );
}
