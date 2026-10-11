import type { UserGameWithUserData } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { GameCover } from "@/components/game/game-cover";
import { LogGameDialog } from "@/components/game/log-game-dialog";
import { RatingValue, StatusPill } from "@/components/game/rating";
import { Button } from "@/components/ui/button";
import { gameTypeName, releaseYear, shortDate } from "@/lib/format";

interface LibraryRowProps {
  rank: number;
  entry: UserGameWithUserData;
  editable: boolean;
}

/** One list entry: rank, cover, title and metadata on the left, rating and status on the right */
export function LibraryRow({ rank, entry, editable }: LibraryRowProps) {
  const [open, setOpen] = useState(false);
  const data = entry.userGameData;
  const meta = [
    releaseYear(entry.firstReleaseDate),
    gameTypeName(entry.gameType, entry.types[0]?.type),
  ]
    .filter(Boolean)
    .join(" | ");
  const date = shortDate(data.endedAt ?? data.addedAt);

  return (
    <article className="panel relative flex gap-4 overflow-hidden p-3 transition-colors hover:bg-white/[0.05] sm:p-4">
      {entry.cover?.url && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.08] blur-2xl"
          style={{ backgroundImage: `url(${entry.cover.url})` }}
        />
      )}
      <Link
        to="/games/$id"
        params={{ id: String(entry.id) }}
        className="relative w-16 shrink-0 sm:w-20"
      >
        <GameCover url={entry.cover?.url} name={entry.name} />
      </Link>
      <div className="relative min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 rounded bg-white/10 px-1.5 text-xs font-semibold tabular-nums">
            {rank}
          </span>
          <Link
            to="/games/$id"
            params={{ id: String(entry.id) }}
            className="line-clamp-2 font-bold leading-tight hover:underline"
          >
            {entry.name}
          </Link>
        </div>
        <div className="mt-2 space-y-0.5 text-xs text-dimmed">
          {entry.genres.length > 0 && (
            <div className="truncate">{entry.genres.map((g) => g.name).join(", ")}</div>
          )}
          {meta && <div>{meta}</div>}
          {date && <div className="pt-1">{date}</div>}
        </div>
        {data.review && <p className="mt-2 line-clamp-2 text-sm text-white/80">{data.review}</p>}
      </div>
      <div className="relative flex shrink-0 flex-col items-end gap-1.5">
        {editable && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setOpen(true)}
            aria-label="Edit entry"
            className="-mt-1 -mr-1 text-dimmed"
          >
            <PencilIcon />
          </Button>
        )}
        <RatingValue value={data.rating} className="text-2xl" />
        <StatusPill status={data.status} />
      </div>
      {editable && <LogGameDialog game={entry} entry={data} open={open} onOpenChange={setOpen} />}
    </article>
  );
}
