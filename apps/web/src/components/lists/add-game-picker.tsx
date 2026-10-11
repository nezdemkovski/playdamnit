import { useGetApiGamesSearch } from "@playdamnit/api-client";
import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { GameCover } from "@/components/game/game-cover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { releaseYear } from "@/lib/format";

interface AddGamePickerProps {
  exclude: Set<number>;
  onPick: (gameId: number) => Promise<unknown>;
  children: React.ReactNode;
}

/** A small search popover for adding games to a list */
export function AddGamePicker({ exclude, onPick, children }: AddGamePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const results = useGetApiGamesSearch(
    { q, limit: 8 },
    { query: { enabled: q.length >= 2, placeholderData: (p) => p } },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 rounded-xl border-white/10 bg-popover p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games…"
          autoFocus
          className="rounded-full"
        />
        <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {results.data?.results.map((game) => {
            const added = exclude.has(game.id);
            return (
              <li
                key={game.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
              >
                <GameCover
                  url={game.cover?.url}
                  name={game.name}
                  size="cover_small"
                  className="w-8 rounded"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{game.name}</div>
                  <div className="text-xs text-dimmed">{releaseYear(game.firstReleaseDate)}</div>
                </div>
                <Button
                  size="icon-xs"
                  variant={added ? "secondary" : "default"}
                  disabled={added}
                  aria-label="Add"
                  onClick={() => onPick(game.id)}
                >
                  <PlusIcon />
                </Button>
              </li>
            );
          })}
          {q.length >= 2 && results.data?.results.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-dimmed">No games found.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
