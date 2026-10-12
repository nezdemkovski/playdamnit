import type { Game } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";

import { Rail } from "@/components/rail";

import { GameCover } from "./game-cover";
import { GradeBadge } from "./rating";
import type { Grade } from "@/lib/enums";
import { releaseYear } from "@/lib/format";

/** A catalog card, or a library index item, whose cover is the URL itself */
type CardGame = Pick<Game, "id" | "name" | "firstReleaseDate"> & {
  cover: Game["cover"] | string | null;
};

interface GameCardProps {
  game: CardGame;
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
      <GameCover
        url={typeof game.cover === "string" ? game.cover : game.cover?.url}
        name={game.name}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-end overflow-hidden bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <div className="line-clamp-2 text-sm font-bold leading-tight text-white">{game.name}</div>
        {year && <div className="num mt-0.5 text-[11px] text-white/70">{year}</div>}
      </div>
      {tag ? (
        <div className="num absolute top-0 left-0 bg-signal px-1.5 py-0.5 text-[10px] font-extrabold text-black">
          {tag}
        </div>
      ) : null}
      {grade ? (
        <GradeBadge grade={grade} onArt className="absolute -top-2.5 -right-2.5 block" />
      ) : null}
    </Link>
  );
}

/** Horizontal rail of cards (home page rows, related games); seals may overhang the corners */
export function GameRail({
  children,
  itemClassName = "basis-28 sm:basis-32 md:basis-36",
  className,
}: {
  children: React.ReactNode;
  itemClassName?: string;
  className?: string;
}) {
  return (
    <Rail overhang itemClassName={itemClassName} className={className}>
      {children}
    </Rail>
  );
}
