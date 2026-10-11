import type { UserGameWithUserData } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";

import { GameCover } from "@/components/game/game-cover";
import { LogGameDialog } from "@/components/game/log-game-dialog";
import { RatingValue, StatusPill } from "@/components/game/rating";
import { Button } from "@/components/ui/button";
import { gameTypeName, releaseYear } from "@/lib/format";
import { idleDays, idleLine } from "@/lib/voice";

interface LibraryRowProps {
  rank: number;
  entry: UserGameWithUserData;
  editable: boolean;
}

const IDLE_FULL = 180;

/** One list entry: rank, cover, title and metadata, idle time with a bar, rating, status */
export function LibraryRow({ rank, entry, editable }: LibraryRowProps) {
  const [open, setOpen] = useState(false);
  const data = entry.userGameData;
  const status = data.status;
  const idle = idleDays(entry);
  const barWidth =
    status === "finished"
      ? 100
      : status === "dropped"
        ? 4
        : Math.min(100, Math.round((idle / IDLE_FULL) * 100));
  const barColor =
    status === "finished"
      ? "bg-done"
      : status === "playing" || status === "on_hold"
        ? "bg-warning"
        : "bg-signal";
  const meta = [
    entry.genres[0]?.name,
    releaseYear(entry.firstReleaseDate),
    gameTypeName(entry.gameType, entry.types[0]?.type),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="grid grid-cols-[28px_52px_1fr_auto] items-center gap-4 border-b border-border py-3 transition-colors last:border-b-0 hover:bg-card sm:grid-cols-[36px_56px_1fr_170px_72px_110px_32px]">
      <span className="num text-sm font-extrabold text-dimmed">
        {String(rank).padStart(2, "0")}
      </span>
      <Link to="/games/$id" params={{ id: String(entry.id) }}>
        <GameCover url={entry.cover?.url} name={entry.name} />
      </Link>
      <div className="min-w-0">
        <Link
          to="/games/$id"
          params={{ id: String(entry.id) }}
          className="line-clamp-1 text-[15px] font-bold hover:underline"
        >
          {entry.name}
        </Link>
        <div className="mt-0.5 truncate text-xs text-dimmed">{meta}</div>
        {data.review && <p className="mt-1 line-clamp-1 text-xs text-white/70">{data.review}</p>}
      </div>
      <div className="hidden sm:block">
        <div className="h-1.5 bg-card">
          <i className={cn("block h-full", barColor)} style={{ width: `${barWidth}%` }} />
        </div>
        <div className="num mt-1.5 text-[11px] text-dimmed">{idleLine(entry)}</div>
      </div>
      <div className="hidden text-right sm:block">
        {data.rating ? (
          <RatingValue value={data.rating} className="text-2xl" />
        ) : (
          <span className="eyebrow">unrated</span>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 sm:justify-start">
        <RatingValue value={data.rating} className="text-lg sm:hidden" />
        <StatusPill status={status} />
      </div>
      <div className="hidden sm:block">
        {editable && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setOpen(true)}
            aria-label="Edit entry"
            className="text-dimmed"
          >
            <PencilIcon />
          </Button>
        )}
      </div>
      {editable && <LogGameDialog game={entry} entry={data} open={open} onOpenChange={setOpen} />}
    </article>
  );
}
