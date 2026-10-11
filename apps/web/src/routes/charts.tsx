import { useGetApiCatalog, useGetApiGames, type Game } from "@playdamnit/api-client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarIcon,
  FlameIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

import { GameCover } from "@/components/game/game-cover";
import { RatingValue } from "@/components/game/rating";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyLibrary } from "@/hooks/library";
import { compactNumber, gameTypeName, releaseYear } from "@/lib/format";

const TABS = [
  { value: "popular", label: "Popular", icon: FlameIcon, sort: "popular" },
  { value: "best", label: "Best", icon: StarIcon, sort: "rating" },
  { value: "wanted", label: "Wanted", icon: SparklesIcon, sort: "wanted" },
  { value: "played", label: "Most played", icon: UsersIcon, sort: "played" },
  { value: "upcoming", label: "Upcoming", icon: CalendarIcon, sort: "upcoming" },
] as const;
type Tab = (typeof TABS)[number]["value"];
const PAGE = 50;
const YEARS = Array.from(
  { length: new Date().getFullYear() + 2 - 1980 },
  (_, i) => new Date().getFullYear() + 1 - i,
);

export const Route = createFileRoute("/charts")({
  validateSearch: (raw: Record<string, unknown>) => ({
    tab: (TABS.some((t) => t.value === raw.tab) ? raw.tab : "popular") as Tab,
    genreId: typeof raw.genreId === "number" ? raw.genreId : undefined,
    platformId: typeof raw.platformId === "number" ? raw.platformId : undefined,
    year: typeof raw.year === "number" ? raw.year : undefined,
    type: typeof raw.type === "number" ? raw.type : undefined,
    page: typeof raw.page === "number" && raw.page > 0 ? raw.page : 1,
  }),
  component: ChartsPage,
});

const ALL = "all";

/** Ranked catalog tables with genre / platform / year / type filters */
function ChartsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/charts" });
  const { byGameId } = useMyLibrary();
  const lookups = useGetApiCatalog();
  const tab = TABS.find((t) => t.value === search.tab)!;

  const query = useGetApiGames(
    {
      sort: tab.sort,
      limit: PAGE,
      offset: (search.page - 1) * PAGE,
      genreId: search.genreId,
      platformId: search.platformId,
      year: search.year,
      types: search.type !== undefined ? String(search.type) : undefined,
    },
    { query: { placeholderData: (prev) => prev } },
  );
  const total = query.data?.meta.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const set = (patch: Partial<typeof search>) =>
    navigate({ search: { ...search, ...patch, page: 1 } });

  return (
    <>
      <h1 className="text-2xl font-bold">Charts</h1>
      <div className="no-scrollbar mt-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <TabButton
            key={t.value}
            icon={t.icon}
            active={t.value === search.tab}
            onClick={() => set({ tab: t.value })}
          >
            {t.label}
          </TabButton>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          value={search.genreId !== undefined ? String(search.genreId) : ALL}
          onValueChange={(v) => set({ genreId: v === ALL ? undefined : Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All genres</SelectItem>
            {lookups.data?.genres.map((g) => (
              <SelectItem key={g.id} value={String(g.id)}>
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.platformId !== undefined ? String(search.platformId) : ALL}
          onValueChange={(v) => set({ platformId: v === ALL ? undefined : Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All platforms</SelectItem>
            {lookups.data?.platforms.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.year !== undefined ? String(search.year) : ALL}
          onValueChange={(v) => set({ year: v === ALL ? undefined : Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any year</SelectItem>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={search.type !== undefined ? String(search.type) : ALL}
          onValueChange={(v) => set({ type: v === ALL ? undefined : Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any type</SelectItem>
            {lookups.data?.types.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">
          {tab.label}
          <span className="ml-2 text-sm font-semibold text-dimmed">
            {query.data ? `${compactNumber(total)} games` : ""}
          </span>
        </h2>
        <span className="text-xs text-dimmed">
          {tab.value === "best"
            ? "By IGDB rating, 50+ votes"
            : tab.value === "popular"
              ? "By IGDB rating count"
              : tab.value === "upcoming"
                ? "Soonest first"
                : "By members of this site"}
        </span>
      </div>

      <ol className="mt-3 space-y-2">
        {query.isPending
          ? Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-16 rounded-card" />)
          : query.data?.results.map((game, i) => (
              <ChartRow
                key={game.id}
                rank={(search.page - 1) * PAGE + i + 1}
                game={game}
                tab={tab.value}
                rating={byGameId.get(game.id)?.userGameData.rating}
              />
            ))}
      </ol>

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

function ChartRow({
  rank,
  game,
  tab,
  rating,
}: {
  rank: number;
  game: Game;
  tab: Tab;
  rating?: number | null;
}) {
  const igdb = game.totalRating ? game.totalRating / 10 : null;
  return (
    <li className="panel flex items-center gap-3 p-2 pr-4 transition-colors hover:bg-white/[0.05]">
      <span className="w-8 text-center text-sm font-bold tabular-nums text-dimmed">{rank}</span>
      <Link to="/games/$id" params={{ id: String(game.id) }} className="w-10 shrink-0">
        <GameCover
          url={game.cover?.url}
          name={game.name}
          size="cover_small"
          className="rounded-md"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to="/games/$id"
          params={{ id: String(game.id) }}
          className="line-clamp-1 font-bold hover:underline"
        >
          {game.name}
        </Link>
        <div className="truncate text-xs text-dimmed">
          {[
            releaseYear(game.firstReleaseDate),
            gameTypeName(game.gameType, game.types[0]?.type),
            game.genres
              .slice(0, 3)
              .map((g) => g.name)
              .join(", "),
          ]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-sm">
        {rating ? <RatingValue value={rating} /> : null}
        {tab !== "upcoming" && igdb ? (
          <span className="flex items-center gap-1 text-dimmed">
            <StarIcon className="size-3.5" />
            <RatingValue value={igdb} className="text-white" />
            <span className="text-xs">({compactNumber(game.totalRatingCount ?? 0)})</span>
          </span>
        ) : null}
      </div>
    </li>
  );
}

function TabButton({
  icon: Icon,
  active,
  onClick,
  children,
}: {
  icon: LucideIcon;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-dimmed hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}
