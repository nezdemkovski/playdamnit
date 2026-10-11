import {
  GetApiGamesSort,
  useGetApiGames,
  useGetApiGamesReleaseDays,
  type Game,
  type UserGameData,
} from "@playdamnit/api-client";
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
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { GameCover } from "@/components/game/game-cover";
import { GradeBadge, StatusPill } from "@/components/game/rating";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/auth";
import { useMyLibrary } from "@/hooks/library";
import { format } from "@/i18n/date";
import { DateFormat, FlagValue, IgdbSize, PillSize } from "@/lib/enums";
import { compactNumber, gameTypeName } from "@/lib/format";
import { gradeOf } from "@/lib/grade";

// The month's most popular releases give the grid its covers; every day is counted
const COVER_POOL = 100;
const COVERS_PER_DAY = 3;
// A day's list in the dialog grows by this much, up to the API's page size
const DAY_PAGE = 40;
const DAY_MAX = 100;
const WEEK_STARTS_ON = 1;
const DAY_SECONDS = 86_400;

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

// Release dates are counted per UTC day on the server; the grid uses the same days
const utcStart = (date: Date) =>
  Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 1000);

const monthBounds = (month: string) => {
  const start = parse(month, DateFormat.IsoMonth, new Date());
  const end = addMonths(start, 1);
  return { from: utcStart(start), to: utcStart(end) - 1, start };
};

const dayOf = (epoch: number | null | undefined) =>
  epoch ? new Date(epoch * 1000).toISOString().slice(0, 10) : null;

/** Release calendar: a month grid with every day's real count and its biggest covers */
function CalendarPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/calendar" });
  const { user } = useSession();
  const { byGameId, entries } = useMyLibrary();
  const { from, to, start } = monthBounds(search.month);
  const popular = search.hot ? FlagValue.One : undefined;
  const [openDay, setOpenDay] = useState<string | null>(null);

  const top = useGetApiGames(
    {
      sort: GetApiGamesSort.Popular,
      releasedFrom: from,
      releasedTo: to,
      limit: COVER_POOL,
      popular,
    },
    { query: { placeholderData: (prev) => prev, enabled: !search.mine } },
  );
  const days = useGetApiGamesReleaseDays(
    { releasedFrom: from, releasedTo: to, popular },
    { query: { placeholderData: (prev) => prev, enabled: !search.mine } },
  );

  // "My list only" works from the library: its games that release this month
  const mine = useMemo(
    () =>
      entries.filter(
        (e) =>
          e.firstReleaseDate &&
          e.firstReleaseDate >= from &&
          e.firstReleaseDate <= to &&
          (!search.hot || e.isPopular),
      ),
    [entries, from, to, search.hot],
  );

  const { coversByDay, countByDay, total } = useMemo(() => {
    const covers = new Map<string, Game[]>();
    const counts = new Map<string, number>();
    const pool: Game[] = search.mine ? mine : (top.data?.results ?? []);
    for (const g of pool) {
      const key = dayOf(g.firstReleaseDate);
      if (key) covers.set(key, [...(covers.get(key) ?? []), g]);
    }
    if (search.mine) {
      for (const [key, list] of covers) counts.set(key, list.length);
    } else {
      for (const d of days.data?.days ?? []) counts.set(d.date, d.count);
    }
    let sum = 0;
    for (const n of counts.values()) sum += n;
    return { coversByDay: covers, countByDay: counts, total: sum };
  }, [search.mine, mine, top.data, days.data]);

  // Weeks covering the month, Monday first
  const weeks = useMemo(() => {
    const all = eachDayOfInterval({
      start: startOfWeek(startOfMonth(start), { weekStartsOn: WEEK_STARTS_ON }),
      end: endOfWeek(endOfMonth(start), { weekStartsOn: WEEK_STARTS_ON }),
    });
    const rows: Date[][] = [];
    for (let i = 0; i < all.length; i += 7) rows.push(all.slice(i, i + 7));
    return rows;
  }, [start]);

  const go = (delta: number) =>
    navigate({
      search: { ...search, month: format(addMonths(start, delta), DateFormat.IsoMonth) },
    });
  const loading = !search.mine && (days.isPending || top.isPending);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl">{t("calendar.title")}</h1>
          <div className="eyebrow mt-1.5">
            {loading
              ? t("calendar.counting")
              : t("calendar.summary", { count: total, total: compactNumber(total) })}
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

      {loading ? (
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
                return (
                  <DayCell
                    key={key}
                    day={day}
                    inMonth={isSameMonth(day, start)}
                    count={countByDay.get(key) ?? 0}
                    covers={coversByDay.get(key) ?? []}
                    onOpen={() => setOpenDay(key)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {!loading && total === 0 && (
        <div className="panel mt-6 p-12 text-center text-dimmed">{t("calendar.empty")}</div>
      )}

      <DayDialog
        day={openDay}
        hot={search.hot}
        mine={search.mine}
        mineGames={mine}
        count={openDay ? (countByDay.get(openDay) ?? 0) : 0}
        byGameId={byGameId}
        onClose={() => setOpenDay(null)}
      />
    </>
  );
}

/** One day of the grid: its number, the real count, up to three covers and "+N" for the rest */
function DayCell({
  day,
  inMonth,
  count,
  covers,
  onOpen,
}: {
  day: Date;
  inMonth: boolean;
  count: number;
  covers: Game[];
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const has = count > 0;
  // More than fits: two covers and a "+N" tile, so the tile always has a slot
  const overflow = count > COVERS_PER_DAY;
  const shown = covers.slice(0, overflow ? COVERS_PER_DAY - 1 : COVERS_PER_DAY);
  const rest = count - shown.length;
  return (
    <button
      type="button"
      disabled={!has}
      onClick={onOpen}
      aria-label={
        has
          ? t("calendar.openDay", { count, date: format(day, DateFormat.MonthDayLong) })
          : undefined
      }
      className={cn(
        "group flex min-h-16 flex-col gap-1.5 border-r border-border p-1.5 text-left transition-colors last:border-r-0 sm:min-h-28 sm:p-2",
        !inMonth && "opacity-30",
        has ? "cursor-pointer hover:bg-card" : "cursor-default",
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
        {has && (
          <span className="num text-[10px] font-bold text-dimmed group-hover:text-foreground">
            {count}
          </span>
        )}
      </div>
      {has && (
        <div className="hidden grid-cols-3 gap-1 sm:grid">
          {shown.map((g) => (
            <GameCover key={g.id} url={g.cover?.url} name={g.name} size={IgdbSize.CoverSmall} />
          ))}
          {rest > 0 && shown.length < COVERS_PER_DAY && (
            <span className="num flex aspect-[3/4] items-center justify-center border border-border text-[11px] font-extrabold text-dimmed group-hover:border-foreground/40 group-hover:text-foreground">
              +{compactNumber(rest)}
            </span>
          )}
        </div>
      )}
      {has && <div className="mt-auto h-1 w-full bg-signal sm:hidden" />}
    </button>
  );
}

/** Every release of one day, most popular first, in a dialog */
function DayDialog({
  day,
  hot,
  mine,
  mineGames,
  count,
  byGameId,
  onClose,
}: {
  day: string | null;
  hot: boolean;
  mine: boolean;
  mineGames: Game[];
  count: number;
  byGameId: Map<number, { userGameData: UserGameData }>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(DAY_PAGE);
  const date = day ? parse(day, DateFormat.IsoDay, new Date()) : null;
  const from = date ? utcStart(date) : 0;
  const query = useGetApiGames(
    {
      sort: GetApiGamesSort.Popular,
      releasedFrom: from,
      releasedTo: from + DAY_SECONDS - 1,
      limit,
      popular: hot ? FlagValue.One : undefined,
    },
    { query: { enabled: !!day && !mine, placeholderData: (prev) => prev } },
  );
  const games = mine
    ? mineGames.filter((g) => dayOf(g.firstReleaseDate) === day)
    : (query.data?.results ?? []);
  const canGrow = !mine && games.length < count && limit < DAY_MAX;

  return (
    <Dialog
      open={!!day}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setLimit(DAY_PAGE);
        }
      }}
    >
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 rounded-card border-white/5 bg-popover p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border p-5 text-left">
          <DialogTitle className="text-xl">
            {date ? format(date, DateFormat.WeekdayMonthDay) : ""}
          </DialogTitle>
          <DialogDescription className="eyebrow">
            {t("calendar.count", { count })}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {!mine && query.isPending ? (
            <div className="space-y-2 py-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : (
            games.map((game, i) => (
              <DayRow
                key={game.id}
                rank={i + 1}
                game={game}
                entry={byGameId.get(game.id)?.userGameData}
                onNavigate={onClose}
              />
            ))
          )}
          {canGrow && (
            <div className="flex justify-center py-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={query.isFetching}
                onClick={() => setLimit((l) => Math.min(DAY_MAX, l + DAY_PAGE))}
              >
                {t("calendar.showMore", { count: Math.min(DAY_PAGE, count - games.length) })}
              </Button>
            </div>
          )}
          {!mine && !canGrow && games.length < count && (
            <p className="eyebrow py-4 text-center">
              {t("calendar.capped", { shown: games.length, total: count })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DayRow({
  rank,
  game,
  entry,
  onNavigate,
}: {
  rank: number;
  game: Game;
  entry?: UserGameData;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-[28px_44px_1fr_auto] items-center gap-4 border-b border-border py-3 last:border-b-0">
      <span className="num text-sm font-extrabold text-dimmed">
        {String(rank).padStart(2, "0")}
      </span>
      <Link to="/games/$id" params={{ id: String(game.id) }} onClick={onNavigate}>
        <GameCover url={game.cover?.url} name={game.name} size={IgdbSize.CoverSmall} />
      </Link>
      <div className="min-w-0">
        <Link
          to="/games/$id"
          params={{ id: String(game.id) }}
          onClick={onNavigate}
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
        {entry ? (
          <>
            <GradeBadge grade={gradeOf(entry.rating)} size={PillSize.Md} />
            <StatusPill status={entry.status} />
          </>
        ) : game.totalRatingCount ? (
          <span className="eyebrow">{t("calendar.ratings", { count: game.totalRatingCount })}</span>
        ) : null}
      </div>
    </div>
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
