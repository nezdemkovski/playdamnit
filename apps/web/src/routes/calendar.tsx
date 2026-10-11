import { GetApiGamesSort, useGetApiGames, type Game } from "@playdamnit/api-client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, FlameIcon, LibraryIcon } from "lucide-react";
import { cn } from "cn";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { GameCover } from "@/components/game/game-cover";
import { GradeBadge, StatusPill } from "@/components/game/rating";
import { gradeOf } from "@/lib/grade";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/auth";
import { useMyLibrary } from "@/hooks/library";
import { format } from "@/i18n/date";
import { DateFormat, IgdbSize, PillSize } from "@/lib/enums";
import { compactNumber, gameTypeName } from "@/lib/format";

// The month's most popular releases are drawn; the rest are only counted
const LIMIT = 100;
const COVERS_PER_DAY = 3;
const WEEK_STARTS_ON = 1;

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

const dayOf = (game: Game) =>
  game.firstReleaseDate ? format(new Date(game.firstReleaseDate * 1000), DateFormat.IsoDay) : null;

/** Release calendar: a month grid with the biggest releases on each day, the day's list below */
function CalendarPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/calendar" });
  const { user } = useSession();
  const { byGameId } = useMyLibrary();
  const { from, to, start } = monthBounds(search.month);

  const query = useGetApiGames(
    { sort: GetApiGamesSort.Popular, releasedFrom: from, releasedTo: to, limit: LIMIT },
    { query: { placeholderData: (prev) => prev } },
  );
  const total = query.data?.meta.total ?? 0;

  const games = useMemo(
    () =>
      (query.data?.results ?? []).filter(
        (g) => (!search.hot || g.isPopular) && (!search.mine || byGameId.has(g.id)),
      ),
    [query.data, search.hot, search.mine, byGameId],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of games) {
      const key = dayOf(g);
      if (!key) continue;
      map.set(key, [...(map.get(key) ?? []), g]);
    }
    return map;
  }, [games]);

  // Weeks covering the month, Monday first
  const weeks = useMemo(() => {
    const days = eachDayOfInterval({
      start: startOfWeek(startOfMonth(start), { weekStartsOn: WEEK_STARTS_ON }),
      end: endOfWeek(endOfMonth(start), { weekStartsOn: WEEK_STARTS_ON }),
    });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
    return rows;
  }, [start]);

  // Selected day: today when it is in this month and has releases, otherwise the busiest day
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const todayKey = format(new Date(), DateFormat.IsoDay);
    if (isSameMonth(new Date(), start) && byDay.has(todayKey)) {
      setSelected(todayKey);
      return;
    }
    const busiest = [...byDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    setSelected(busiest?.[0] ?? null);
  }, [byDay, start]);

  const go = (delta: number) =>
    navigate({
      search: { ...search, month: format(addMonths(start, delta), DateFormat.IsoMonth) },
    });
  const selectedGames = selected ? (byDay.get(selected) ?? []) : [];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("calendar.title")}</h1>
          <div className="eyebrow mt-1.5">
            {query.data
              ? t("calendar.summary", {
                  total: compactNumber(total),
                  shown: Math.min(LIMIT, games.length),
                })
              : t("calendar.counting")}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => go(-1)}
            aria-label={t("calendar.previousMonth")}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="num min-w-36 text-center text-sm font-extrabold">
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
      </div>

      {query.isPending ? (
        <Skeleton className="mt-6 aspect-[7/5] w-full" />
      ) : (
        <div className="mt-6 border border-border">
          <div className="grid grid-cols-7 border-b border-border">
            {weeks[0].map((day) => (
              <div key={day.toISOString()} className="eyebrow px-2 py-2 text-center sm:text-left">
                {format(day, DateFormat.WeekdayShort)}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div
              key={week[0].toISOString()}
              className="grid grid-cols-7 border-b border-border last:border-b-0"
            >
              {week.map((day) => {
                const key = format(day, DateFormat.IsoDay);
                const list = byDay.get(key) ?? [];
                const inMonth = isSameMonth(day, start);
                const active = selected === key;
                const hasGames = list.length > 0;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!hasGames}
                    onClick={() => setSelected(key)}
                    aria-pressed={active}
                    className={cn(
                      "flex min-h-16 flex-col gap-1.5 border-r border-border p-1.5 text-left transition-colors last:border-r-0 sm:min-h-28 sm:p-2",
                      !inMonth && "opacity-30",
                      hasGames ? "hover:bg-card" : "cursor-default",
                      active && "bg-card",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "num text-[11px] font-extrabold sm:text-xs",
                          isToday(day) ? "bg-signal px-1 text-black" : "text-dimmed",
                        )}
                      >
                        {format(day, DateFormat.DayOfMonth)}
                      </span>
                      {hasGames && (
                        <span className="num text-[10px] font-bold text-dimmed">{list.length}</span>
                      )}
                    </div>
                    {hasGames && (
                      <div className="hidden grid-cols-3 gap-1 sm:grid">
                        {list.slice(0, COVERS_PER_DAY).map((g) => (
                          <GameCover
                            key={g.id}
                            url={g.cover?.url}
                            name={g.name}
                            size={IgdbSize.CoverSmall}
                          />
                        ))}
                      </div>
                    )}
                    {hasGames && <div className="mt-auto h-1 w-full bg-signal sm:hidden" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {query.data && games.length === 0 && (
        <div className="panel mt-6 p-12 text-center text-dimmed">{t("calendar.empty")}</div>
      )}

      {selected && selectedGames.length > 0 && (
        <section className="mt-8">
          <header className="mb-3 flex items-baseline justify-between border-b border-border pb-3">
            <h2 className="text-xl">
              {format(parse(selected, DateFormat.IsoDay, new Date()), DateFormat.WeekdayMonthDay)}
            </h2>
            <span className="eyebrow">{t("calendar.count", { count: selectedGames.length })}</span>
          </header>
          <div>
            {selectedGames.map((game, i) => {
              const mine = byGameId.get(game.id)?.userGameData;
              return (
                <div
                  key={game.id}
                  className="grid grid-cols-[28px_52px_1fr_auto] items-center gap-4 border-b border-border py-3 last:border-b-0"
                >
                  <span className="num text-sm font-extrabold text-dimmed">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Link to="/games/$id" params={{ id: String(game.id) }}>
                    <GameCover url={game.cover?.url} name={game.name} />
                  </Link>
                  <div className="min-w-0">
                    <Link
                      to="/games/$id"
                      params={{ id: String(game.id) }}
                      className="line-clamp-1 font-bold hover:underline"
                    >
                      {game.name}
                    </Link>
                    <div className="mt-0.5 truncate text-xs text-dimmed">
                      {[
                        gameTypeName(game.gameType, game.types[0]?.type),
                        game.genres
                          .slice(0, 2)
                          .map((g) => g.name)
                          .join(", "),
                        game.platforms
                          .slice(0, 4)
                          .map((p) => p.abbreviation ?? p.name)
                          .join(" · "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {mine ? (
                      <>
                        <GradeBadge grade={gradeOf(mine.rating)} size={PillSize.Md} />
                        <StatusPill status={mine.status} />
                      </>
                    ) : game.totalRatingCount ? (
                      <span className="eyebrow">
                        {t("calendar.ratings", { count: game.totalRatingCount })}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
        "flex items-center gap-1.5 border px-3 py-1 font-medium transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border text-dimmed hover:text-white",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
