import type { Game } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import { GameCover } from "./game-cover";
import { RatingValue } from "./rating";
import { releaseYear } from "@/lib/format";

interface GameCardProps {
  game: Pick<Game, "id" | "name" | "cover" | "firstReleaseDate">;
  /** The viewer's own rating, shown as a corner badge */
  rating?: number | null;
  className?: string;
}

/** Poster card for grids and rails: cover, hover overlay with the title and year */
export function GameCard({ game, rating, className }: GameCardProps) {
  const year = releaseYear(game.firstReleaseDate);
  return (
    <Link
      to="/games/$id"
      params={{ id: String(game.id) }}
      className={cn(
        "group relative block overflow-hidden rounded-lg outline-none transition-transform duration-200 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      title={game.name}
    >
      <GameCover url={game.cover?.url} name={game.name} className="rounded-lg" />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <div className="line-clamp-2 text-sm font-bold leading-tight text-white drop-shadow">
          {game.name}
        </div>
        {year && <div className="mt-0.5 text-xs text-white/70">{year}</div>}
      </div>
      {rating ? (
        <div className="absolute top-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 text-xs backdrop-blur-sm">
          <RatingValue value={rating} />
        </div>
      ) : null}
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
