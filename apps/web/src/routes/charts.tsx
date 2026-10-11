import {
  GetApiGamesSort,
  useGetApiCatalog,
  useGetApiGames,
  type Game,
} from "@playdamnit/api-client";
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
import { useTranslation } from "react-i18next";

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
import { IgdbSize } from "@/lib/enums";
import { ChartTab } from "@/lib/enums";

const TABS = [
  { value: ChartTab.Popular, icon: FlameIcon, sort: GetApiGamesSort.Popular },
  { value: ChartTab.Best, icon: StarIcon, sort: GetApiGamesSort.Rating },
  { value: ChartTab.Wanted, icon: SparklesIcon, sort: GetApiGamesSort.Wanted },
  { value: ChartTab.Played, icon: UsersIcon, sort: GetApiGamesSort.Played },
  { value: ChartTab.Upcoming, icon: CalendarIcon, sort: GetApiGamesSort.Upcoming },
] as const;
const PAGE = 50;
const YEARS = Array.from(
  { length: new Date().getFullYear() + 2 - 1980 },
  (_, i) => new Date().getFullYear() + 1 - i,
);

export const Route = createFileRoute("/charts")({
  validateSearch: (raw: Record<string, unknown>) => ({
    tab: (TABS.some((tb) => tb.value === raw.tab) ? raw.tab : ChartTab.Popular) as ChartTab,
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
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/charts" });
  const { byGameId } = useMyLibrary();
  const lookups = useGetApiCatalog();
  const tab = TABS.find((tb) => tb.value === search.tab)!;

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
      <h1 className="text-2xl font-bold">{t("charts.title")}</h1>
      <div className="no-scrollbar mt-4 flex gap-1 overflow-x-auto">
        {TABS.map((tb) => (
          <TabButton
            key={tb.value}
            icon={tb.icon}
            active={tb.value === search.tab}
            onClick={() => set({ tab: tb.value })}
          >
            {t(`charts.tabs.${tb.value}`)}
          </TabButton>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          value={search.genreId !== undefined ? String(search.genreId) : ALL}
          onValueChange={(v) => set({ genreId: v === ALL ? undefined : Number(v) })}
        >
          <SelectTrigger>
            <SelectValue placeholder={t("charts.genre")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("charts.allGenres")}</SelectItem>
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
            <SelectValue placeholder={t("charts.platform")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("charts.allPlatforms")}</SelectItem>
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
            <SelectValue placeholder={t("charts.year")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("charts.anyYear")}</SelectItem>
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
            <SelectValue placeholder={t("charts.type")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("charts.anyType")}</SelectItem>
            {lookups.data?.types.map((tp) => (
              <SelectItem key={tp.id} value={String(tp.id)}>
                {gameTypeName(tp.id, tp.type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">
          {t(`charts.tabs.${tab.value}`)}
          <span className="ml-2 text-sm font-semibold text-dimmed">
            {query.data ? t("charts.games", { count: total, formatted: compactNumber(total) }) : ""}
          </span>
        </h2>
        <span className="text-xs text-dimmed">
          {tab.value === ChartTab.Best
            ? t("charts.blurb.best")
            : tab.value === ChartTab.Popular
              ? t("charts.blurb.popular")
              : tab.value === ChartTab.Upcoming
                ? t("charts.blurb.upcoming")
                : t("charts.blurb.members")}
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
            {t("common.previous")}
          </Button>
          <span className="text-dimmed">{t("common.pageOf", { page: search.page, pages })}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={search.page >= pages}
            onClick={() => navigate({ search: { ...search, page: search.page + 1 } })}
          >
            {t("common.next")}
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
  tab: ChartTab;
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
          size={IgdbSize.CoverSmall}
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
        {tab !== ChartTab.Upcoming && igdb ? (
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
