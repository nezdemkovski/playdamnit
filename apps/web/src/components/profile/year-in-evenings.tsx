import { cell, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import {
  StatusEnum,
  useGetApiUserByUsernameSteamActivity,
  type GetApiUserByUsernameSteamActivity200DaysItem,
  type UserGameWithUserData,
} from "@playdamnit/api-client";
import { differenceInCalendarDays, startOfWeek, subDays } from "date-fns";
import { cn } from "cn";
import { useMemo } from "react";

import { t } from "@/i18n";
import { format } from "@/i18n/date";
import { DateFormat, DayAction, Weekday } from "@/lib/enums";
import { formatPlaytime } from "@/lib/format";

const DAYS = 364;
const EMPTY: GetApiUserByUsernameSteamActivity200DaysItem[] = [];
const WEEKDAYS = Object.values(Weekday);
const ACTIONS = Object.values(DayAction);
// Games listed per action in the tooltip before "+N more"
const NAMES_SHOWN = 4;

// GitHub-style: one hue, four steps of intensity over the empty cell
const LEVEL_COLORS = [
  "#17181b",
  "rgba(255,43,43,.3)",
  "rgba(255,43,43,.5)",
  "rgba(255,43,43,.75)",
  "#ff2b2b",
];
const LEVELS = LEVEL_COLORS.map((_, i) => i);

interface DayGame {
  name: string;
  /** Steam minutes, only for played games */
  minutes?: number;
}

interface DayRow {
  key: string;
  date: Date;
  week: number;
  weekday: string;
  level: number;
  minutes: number;
  actions: Record<DayAction, DayGame[]>;
}

const dayKey = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), DateFormat.IsoDay) : null;

const emptyActions = () =>
  Object.fromEntries(ACTIONS.map((a) => [a, [] as DayGame[]])) as Record<DayAction, DayGame[]>;

/** Everything done on a day counts once; Steam play counts once per started hour per game */
const scoreOf = (day: { actions: Record<DayAction, DayGame[]> }, played: number[]) =>
  ACTIONS.filter((a) => a !== DayAction.Played).reduce((n, a) => n + day.actions[a].length, 0) +
  played.reduce((n, minutes) => n + Math.max(1, Math.ceil(minutes / 60)), 0);

const useYear = (
  entries: UserGameWithUserData[],
  played: GetApiUserByUsernameSteamActivity200DaysItem[],
) =>
  useMemo(() => {
    const today = new Date();
    const first = subDays(today, DAYS - 1);
    const gridStart = startOfWeek(first, { weekStartsOn: 1 });
    const byDay = new Map<string, Record<DayAction, DayGame[]>>();
    const log = (key: string | null, action: DayAction, name: string, minutes?: number) => {
      if (!key) return;
      const actions = byDay.get(key) ?? emptyActions();
      actions[action].push({ name, minutes });
      byDay.set(key, actions);
    };
    for (const e of entries) {
      const d = e.userGameData;
      const added = dayKey(d.addedAt);
      const ended =
        d.status === StatusEnum.Finished || d.status === StatusEnum.Dropped
          ? dayKey(d.endedAt)
          : null;
      const updated = dayKey(d.updatedAt);
      log(added, DayAction.Added, e.name);
      if (ended)
        log(
          ended,
          d.status === StatusEnum.Finished ? DayAction.Finished : DayAction.Dropped,
          e.name,
        );
      // The last edit, unless it was the add or the finish itself
      if (updated !== added && updated !== ended) log(updated, DayAction.Updated, e.name);
    }
    const playedByDay = new Map(played.map((p) => [p.date, p]));
    for (const p of played)
      for (const g of p.games) log(p.date, DayAction.Played, g.name, g.minutes);

    const days: DayRow[] = [];
    const scores: number[] = [];
    for (let i = 0; i < DAYS; i++) {
      const date = subDays(today, DAYS - 1 - i);
      const key = format(date, DateFormat.IsoDay);
      const actions = byDay.get(key) ?? emptyActions();
      const steam = playedByDay.get(key);
      const score = scoreOf({ actions }, steam?.games.map((g) => g.minutes) ?? []);
      scores.push(score);
      days.push({
        key,
        date,
        week: Math.floor(differenceInCalendarDays(date, gridStart) / 7),
        weekday: WEEKDAYS[(date.getDay() + 6) % 7],
        level: score,
        minutes: steam?.minutes ?? 0,
        actions,
      });
    }
    // Levels by quartiles of the active days, like GitHub: a busy year and a quiet one both
    // use the whole ramp
    const active = scores.filter(Boolean).sort((a, b) => a - b);
    const cut = [0.25, 0.5, 0.75].map((q) => active[Math.floor((active.length - 1) * q)] ?? 0);
    for (const day of days)
      day.level = day.level === 0 ? 0 : 1 + cut.filter((c) => day.level > c).length;
    return { days, first };
  }, [entries, played]);

/**
 * The profile header's year: one cell per day for the last 52 weeks, GitHub-style: the more happened, the redder. The
 * tooltip lists the day's actions with the games. TanStack Charts.
 */
export function YearInEvenings({
  username,
  entries,
  className,
}: {
  username: string;
  entries: UserGameWithUserData[];
  className?: string;
}) {
  const activity = useGetApiUserByUsernameSteamActivity(username);
  const { days, first } = useYear(entries, activity.data?.days ?? EMPTY);

  const heat = useMemo(
    () =>
      defineChart(
        {
          marks: [
            cell(days, {
              x: "week",
              y: "weekday",
              color: "level",
              key: "key",
              inset: 1,
            }),
          ],
          scales: {
            x: { scale: () => scaleBand<number>().paddingInner(0.18), axis: false },
            y: {
              scale: scaleBand<string>().domain(WEEKDAYS).paddingInner(0.18),
              axis: false,
            },
          },
          color: { scale: scaleOrdinal<number, string>(LEVELS, LEVEL_COLORS) },
        },
        // Sized to its content: near the right edge the card would otherwise shrink to a column
        // The portal lifts it out of the profile header, which clips overflow
        { tooltip: { use: tooltip, className: "w-max", portal } },
      ),
    [days],
  );

  return (
    <div className={cn("min-w-0", className)}>
      <div className="eyebrow flex items-center justify-between gap-3 normal-case tracking-normal">
        <span>
          {t("profile.evenings.title", {
            from: format(first, DateFormat.MonthYearShort),
            to: format(new Date(), DateFormat.MonthYearShort),
          })}
        </span>
        <span className="flex items-center gap-1">
          <span className="mr-1">{t("profile.evenings.less")}</span>
          {LEVEL_COLORS.map((color) => (
            <i key={color} className="inline-block size-2" style={{ background: color }} />
          ))}
          <span className="ml-1">{t("profile.evenings.more")}</span>
        </span>
      </div>
      <div className="mt-2 text-foreground">
        <Chart
          definition={heat}
          aspectRatio={53 / 7}
          initialWidth={900}
          ariaLabel={t("profile.evenings.heatAria")}
          renderTooltipBody={({ points }) => {
            const day = points[0]?.datum as DayRow | undefined;
            return day ? <DayTip day={day} /> : null;
          }}
        />
      </div>
    </div>
  );
}

/** A custom body replaces the built-in card, so it brings its own background and border */
function DayTip({ day }: { day: DayRow }) {
  const rows = ACTIONS.filter((a) => day.actions[a].length > 0);
  // Empty days get no tooltip at all
  if (rows.length === 0) return null;
  return (
    <div className="w-60 border border-white/30 bg-background px-2.5 py-1.5 font-sans text-xs font-normal">
      <div className="num font-bold">{format(day.date, DateFormat.WeekdayMonthDay)}</div>
      {rows.map((action) => {
        const games = day.actions[action];
        const rest = games.length - NAMES_SHOWN;
        return (
          <div key={action} className="mt-1.5">
            <div className="font-bold">
              {action === DayAction.Played
                ? t("profile.evenings.tip.played", { time: formatPlaytime(day.minutes) })
                : t(`profile.evenings.tip.${action}`, { count: games.length })}
            </div>
            {games.slice(0, NAMES_SHOWN).map((g, i) => (
              <div key={i} className="flex items-baseline gap-3 text-white/70">
                <span className="min-w-0 flex-1 truncate">{g.name}</span>
                {g.minutes ? (
                  <span className="num shrink-0 text-[11px]">{formatPlaytime(g.minutes)}</span>
                ) : null}
              </div>
            ))}
            {rest > 0 && (
              <div className="text-dimmed">{t("profile.evenings.tip.more", { count: rest })}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
