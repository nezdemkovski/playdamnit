import {
  GetApiGamesSort,
  useGetApiGames,
  type Game,
  getApiGames,
  getGetApiGamesQueryKey,
} from "@playdamnit/api-client";
import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { addMonths, isToday, parse } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, FlameIcon, LibraryIcon } from "lucide-react";
import { cn } from "cn";
import { useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";

import { GameCard } from "@/components/game/game-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/auth";
import { useMyLibrary } from "@/hooks/library";
import { format } from "@/i18n/date";
import { ChartTab, DateFormat } from "@/lib/enums";

const PAGE = 100;
const MAX_PAGES = 6;

export const Route = createFileRoute("/calendar")({
  validateSearch: (raw: Record<string, unknown>) => ({
    month:
      typeof raw.month === "string" && /^\d{4}-\d{2}$/.test(raw.month)
        ? raw.month
        : format(new Date(), DateFormat.IsoMonth),
    hot: raw.hot === true,
    mine: raw.mine === true,
  }),
  component: CalendarPage,
});

const monthBounds = (month: string) => {
  const start = parse(month, DateFormat.IsoMonth, new Date());
  const end = addMonths(start, 1);
  return {
    from: Math.floor(Date.UTC(start.getFullYear(), start.getMonth(), 1) / 1000),
    to: Math.floor(Date.UTC(end.getFullYear(), end.getMonth(), 1) / 1000) - 1,
    start,
  };
};

/** Release calendar: every dated game of the month, grouped by day */
function CalendarPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/calendar" });
  const { user } = useSession();
  const { byGameId } = useMyLibrary();
  const { from, to, start } = monthBounds(search.month);
  const params = { sort: GetApiGamesSort.Date, releasedFrom: from, releasedTo: to, limit: PAGE };

  const first = useGetApiGames({ ...params, offset: 0 });
  const total = first.data?.meta.total ?? 0;
  const extraPages = Math.min(MAX_PAGES, Math.ceil(total / PAGE)) - 1;
  const rest = useQueries({
    queries: Array.from({ length: Math.max(0, extraPages) }, (_, i) => {
      const p = { ...params, offset: (i + 1) * PAGE };
      return {
        queryKey: getGetApiGamesQueryKey(p),
        queryFn: () => getApiGames(p),
        staleTime: 60_000,
      };
    }),
  });

  const games = useMemo(() => {
    const all: Game[] = [
      ...(first.data?.results ?? []),
      ...rest.flatMap((q) => q.data?.results ?? []),
    ];
    return all.filter((g) => (!search.hot || g.isPopular) && (!search.mine || byGameId.has(g.id)));
  }, [first.data, rest, search.hot, search.mine, byGameId]);

  const days = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of games) {
      if (!g.firstReleaseDate) continue;
      const key = format(new Date(g.firstReleaseDate * 1000), DateFormat.IsoDay);
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [games]);

  const go = (delta: number) =>
    navigate({
      search: { ...search, month: format(addMonths(start, delta), DateFormat.IsoMonth) },
    });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("calendar.title")}</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => go(-1)}
            aria-label={t("calendar.previousMonth")}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="min-w-36 text-center font-semibold">
            {format(start, DateFormat.MonthYear)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => go(1)}
            aria-label={t("calendar.nextMonth")}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="secondary"
            size="xs"
            onClick={() =>
              navigate({ search: { ...search, month: format(new Date(), DateFormat.IsoMonth) } })
            }
          >
            {t("common.today")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <FilterChip
          active={search.hot}
          onClick={() => navigate({ search: { ...search, hot: !search.hot } })}
          icon={<FlameIcon className="size-3.5" />}
        >
          {t("calendar.hot")}
        </FilterChip>
        {user && (
          <FilterChip
            active={search.mine}
            onClick={() => navigate({ search: { ...search, mine: !search.mine } })}
            icon={<LibraryIcon className="size-3.5" />}
          >
            {t("calendar.mine")}
          </FilterChip>
        )}
        <span className="ml-auto text-dimmed">
          {first.data ? t("calendar.count", { count: games.length }) : ""}
        </span>
      </div>

      {first.isPending ? (
        <div className="mt-6 space-y-6">
          <Skeleton className="h-8 w-40" />
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="cover" />
            ))}
          </div>
        </div>
      ) : days.length === 0 ? (
        <div className="panel mt-6 p-12 text-center text-dimmed">{t("calendar.empty")}</div>
      ) : (
        days.map(([day, list]) => {
          const date = parse(day, DateFormat.IsoDay, new Date());
          return (
            <section key={day} className="mt-8">
              <h2 className="mb-3 flex items-baseline gap-2 text-lg font-bold">
                {format(date, DateFormat.MonthDayLong)}
                {isToday(date) && (
                  <span className="rounded-full bg-white/10 px-2 text-xs font-semibold">
                    {t("common.today")}
                  </span>
                )}
                <span className="text-sm font-semibold text-dimmed">{list.length}</span>
              </h2>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 md:grid-cols-8">
                {list.map((g) => (
                  <GameCard key={g.id} game={g} rating={byGameId.get(g.id)?.userGameData.rating} />
                ))}
              </div>
            </section>
          );
        })
      )}
      {total > PAGE * MAX_PAGES && (
        <p className="mt-6 text-center text-xs text-dimmed">
          <Trans
            i18nKey="calendar.truncated"
            values={{ shown: PAGE * MAX_PAGES, total }}
            components={{
              link: (
                <Link
                  to="/charts"
                  search={{
                    tab: ChartTab.Upcoming,
                    genreId: undefined,
                    platformId: undefined,
                    year: undefined,
                    type: undefined,
                    page: 1,
                  }}
                  className="underline"
                />
              ),
            }}
          />
        </p>
      )}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-white/10 text-dimmed hover:text-white",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
