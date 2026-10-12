import { Gamepad2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { relativeDate } from "@/lib/format";
import { useSteam } from "./use-steam";

const CHIP =
  "inline-flex items-center gap-1.5 border border-border px-2 py-0.5 text-xs font-semibold text-dimmed";

/**
 * "Steam" in the profile header of a player whose library is connected. The owner can open it:
 * when it last synced, sync now, unlink. Everyone else just sees the chip.
 */
export function SteamBadge({
  username,
  isOwn,
  steamSyncedAt,
}: {
  username: string;
  isOwn: boolean;
  steamSyncedAt?: string | null;
}) {
  const { t } = useTranslation();
  const steam = useSteam(username);
  if (!isOwn) {
    return (
      <span className={CHIP} title={t("steam.badgeTitle")}>
        <Gamepad2Icon className="size-3.5" /> {t("steam.badge")}
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${CHIP} hover:border-foreground/40 hover:text-foreground`}
        >
          <Gamepad2Icon className={steam.pending ? "size-3.5 animate-spin" : "size-3.5"} />{" "}
          {t("steam.badge")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 rounded-none text-sm">
        <div>
          <div className="font-semibold">{t("steam.connected")}</div>
          <div className="text-xs text-dimmed">
            {steamSyncedAt
              ? t("steam.syncedAgo", { when: relativeDate(steamSyncedAt) })
              : t("steam.neverSynced")}
            {" · "}
            {t("steam.auto")}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => steam.importLibrary()}
            disabled={steam.pending}
          >
            {steam.pending ? t("steam.importing") : t("steam.syncNow")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-dimmed hover:text-destructive"
            onClick={steam.unlink}
          >
            {t("steam.unlink")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
