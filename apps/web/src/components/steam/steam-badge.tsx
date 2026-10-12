import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { relativeDate } from "@/lib/format";
import { SteamLogo } from "./steam-logo";
import { useSteam } from "./use-steam";

const CHIP =
  "inline-flex items-center gap-1.5 border border-border px-2 py-0.5 text-xs font-semibold text-dimmed hover:border-foreground/40 hover:text-foreground";

/** The connected Steam account in the profile header: a link for visitors, sync for the owner */
export function SteamBadge({
  username,
  isOwn,
  name,
  url,
  syncedAt,
}: {
  username: string;
  isOwn: boolean;
  name?: string | null;
  url?: string | null;
  syncedAt?: string | null;
}) {
  const { t } = useTranslation();
  const steam = useSteam(username);
  const label = (
    <>
      <SteamLogo className={steam.pending ? "size-3.5 animate-spin" : "size-3.5"} />
      {name || t("steam.badge")}
    </>
  );
  if (!isOwn) {
    return url ? (
      <a href={url} target="_blank" rel="noreferrer nofollow" className={CHIP}>
        {label}
      </a>
    ) : (
      <span className={CHIP}>{label}</span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={CHIP}>
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 space-y-3 rounded-none text-sm">
        {syncedAt && (
          <div className="text-xs text-dimmed">
            {t("steam.syncedAgo", { when: relativeDate(syncedAt) })}
          </div>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => steam.importLibrary()}
            disabled={steam.pending}
          >
            {steam.pending ? t("steam.importing") : t("steam.syncNow")}
          </Button>
          {url && (
            <Button asChild size="sm" variant="ghost">
              <a href={url} target="_blank" rel="noreferrer nofollow">
                {t("steam.open")}
              </a>
            </Button>
          )}
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
