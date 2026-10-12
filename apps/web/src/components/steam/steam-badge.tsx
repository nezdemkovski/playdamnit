import { useTranslation } from "react-i18next";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { relativeDate } from "@/lib/format";
import { SteamLogo } from "./steam-logo";
import { useSteam } from "./use-steam";

const ITEM =
  "flex w-full items-center px-3 py-2 text-left outline-none hover:bg-card focus-visible:bg-card disabled:opacity-50";

// Steam's navy plate with its blue, like a profile card on Steam itself
const CHIP =
  "inline-flex items-center gap-2 bg-gradient-to-r from-steam-ink to-steam-navy pr-3 text-left ring-1 ring-steam-blue/25 transition-shadow hover:ring-steam-blue/70";

/** The connected Steam account in the profile header: a link for visitors, sync for the owner */
export function SteamBadge({
  username,
  isOwn,
  name,
  url,
  avatar,
  syncedAt,
}: {
  username: string;
  isOwn: boolean;
  name?: string | null;
  url?: string | null;
  avatar?: string | null;
  syncedAt?: string | null;
}) {
  const { t } = useTranslation();
  const steam = useSteam(username);
  const label = (
    <>
      {avatar ? (
        <img src={avatar} alt="" className="size-8 shrink-0" />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center bg-steam-ink">
          <SteamLogo className="size-4 text-steam-blue" />
        </span>
      )}
      <span className="min-w-0 leading-none">
        <span className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-widest text-steam-blue">
          <SteamLogo className={steam.pending ? "size-2.5 animate-spin" : "size-2.5"} />
          {t("steam.badge")}
        </span>
        {/* Steam names run to 32 characters; before the first sync there is none yet */}
        {name && (
          <span className="mt-1 block max-w-40 truncate text-[13px] font-bold text-white">
            {name}
          </span>
        )}
      </span>
    </>
  );
  if (!isOwn) {
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noreferrer nofollow"
        className={CHIP}
        title={name ?? undefined}
      >
        {label}
      </a>
    ) : (
      <span className={CHIP} title={name ?? undefined}>
        {label}
      </span>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={CHIP} title={name ?? undefined}>
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // Opening the menu shouldn't put a focus ring on its first item
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-56 rounded-none p-1 text-sm"
      >
        {syncedAt && (
          <div className="px-3 pt-2 pb-1.5 text-xs text-dimmed">
            {t("steam.syncedAgo", { when: relativeDate(syncedAt) })}
          </div>
        )}
        <button
          type="button"
          className={ITEM}
          onClick={() => steam.importLibrary()}
          disabled={steam.pending}
        >
          {steam.pending ? t("steam.importing") : t("steam.syncNow")}
        </button>
        {url && (
          <a href={url} target="_blank" rel="noreferrer nofollow" className={ITEM}>
            {t("steam.open")}
          </a>
        )}
        <button
          type="button"
          className={`${ITEM} text-dimmed hover:text-destructive`}
          onClick={steam.unlink}
        >
          {t("steam.unlink")}
        </button>
      </PopoverContent>
    </Popover>
  );
}
