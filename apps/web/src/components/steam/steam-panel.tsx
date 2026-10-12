import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { SteamConnectButton } from "./steam-connect";
import { SteamLogo } from "./steam-logo";
import { useSteam } from "./use-steam";

/** Settings: Connect Steam, or the linked account with Sync and Unlink */
export function SteamSettings({
  username,
  steamId,
  name,
}: {
  username: string;
  steamId?: string | null;
  name?: string | null;
}) {
  const { t } = useTranslation();
  const steam = useSteam(username);
  if (!steamId) return <SteamConnectButton />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-auto flex items-center gap-2 text-sm font-semibold">
        <SteamLogo className="size-4" /> {name || t("steam.badge")}
      </span>
      <Button variant="secondary" onClick={() => steam.importLibrary()} disabled={steam.pending}>
        {steam.pending ? t("steam.importing") : t("steam.syncNow")}
      </Button>
      <Button variant="ghost" className="text-dimmed hover:text-destructive" onClick={steam.unlink}>
        {t("steam.unlink")}
      </Button>
    </div>
  );
}
