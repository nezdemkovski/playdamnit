import type { Game } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import { GameCover } from "./game-cover";
import { GradeBadge } from "./rating";
import type { Grade } from "@/lib/enums";
import { releaseYear } from "@/lib/format";

interface GameCardProps {
  game: Pick<Game, "id" | "name" | "cover" | "firstReleaseDate">;
  /** The viewer's own grade, shown as a corner tile */
  grade?: Grade | null;
  /** A red corner tag, e.g. days idle */
  tag?: string | null;
  className?: string;
}

/** Poster card for grids and rails: cover, hover overlay with the title and year */
export function GameCard({ game, grade, tag, className }: GameCardProps) {
  const year = releaseYear(game.firstReleaseDate);
  return (
    <Link
      to="/games/$id"
      params={{ id: String(game.id) }}
      className={cn(
        "group relative block outline-none ring-1 ring-transparent transition-[box-shadow] focus-visible:ring-ring",
        className,
      )}
      title={game.name}
    >
      <GameCover url={game.cover?.url} name={game.name} />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end overflow-hidden bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <div className="line-clamp-2 text-sm font-bold leading-tight text-white">{game.name}</div>
        {year && <div className="num mt-0.5 text-[11px] text-white/70">{year}</div>}
      </div>
      {tag ? (
        <div className="num absolute top-0 left-0 bg-signal px-1.5 py-0.5 text-[10px] font-extrabold text-black">
          {tag}
        </div>
      ) : null}
      {grade ? <GradeBadge grade={grade} className="absolute top-1 right-1" /> : null}
    </Link>
  );
}

/** Horizontal rail of cards (home page rows, related games) */
export function GameRail({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [&>*]:w-28 [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-32 md:[&>*]:w-36",
        className,
      )}
    >
      {children}
    </div>
  );
}
