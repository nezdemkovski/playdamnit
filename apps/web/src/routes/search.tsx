import { useGetApiGamesSearch } from "@playdamnit/api-client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { GameCard } from "@/components/game/game-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useMyLibrary } from "@/hooks/library";

const PAGE = 50;

export const Route = createFileRoute("/search")({
  validateSearch: (raw: Record<string, unknown>) => ({
    q: typeof raw.q === "string" ? raw.q : "",
    page: typeof raw.page === "number" && raw.page > 0 ? raw.page : 1,
    editions: raw.editions === true,
  }),
  component: SearchPage,
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [input, setInput] = useState(search.q);
  const { byGameId } = useMyLibrary();

  useEffect(() => setInput(search.q), [search.q]);

  const q = search.q.trim();
  const enabled = q.length >= 2;
  const { data, isPending } = useGetApiGamesSearch(
    { q, limit: PAGE, offset: (search.page - 1) * PAGE, ...(search.editions && { editions: "1" }) },
    { query: { enabled, placeholderData: (prev) => prev } },
  );

  const total = data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ search: { q: input.trim(), page: 1, editions: search.editions } });
        }}
      >
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-dimmed" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search games…"
            className="h-11 rounded-full pl-11 text-base"
            autoFocus
          />
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between gap-4 text-sm text-dimmed">
        <div>
          {enabled && data ? `${total} results for “${q}”` : "Type at least two characters"}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="editions"
            checked={search.editions}
            onCheckedChange={(v) => navigate({ search: { ...search, editions: v, page: 1 } })}
          />
          <Label htmlFor="editions" className="text-dimmed">
            Show editions
          </Label>
        </div>
      </div>

      {enabled && isPending ? (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="cover" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {data?.results.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              rating={byGameId.get(game.id)?.userGameData.rating}
            />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={search.page <= 1}
            onClick={() => navigate({ search: { ...search, page: search.page - 1 } })}
          >
            Previous
          </Button>
          <span className="text-dimmed">
            {search.page} / {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={search.page >= pages}
            onClick={() => navigate({ search: { ...search, page: search.page + 1 } })}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
