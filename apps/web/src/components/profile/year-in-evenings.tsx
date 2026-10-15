import { cell, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react/tooltip";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { tooltip } from "@tanstack/charts/tooltip";
import { portal } from "@tanstack/charts/tooltip/portal";
import {
  useGetApiUserByUsernameActivity,
  type ActivityDay,
  type ActivityGroup,
} from "@playdamnit/api-client";
import { differenceInCalendarDays, startOfWeek, subDays } from "date-fns";
import { cn } from "cn";
import { useLayoutEffect, useMemo, useRef } from "react";

import { t } from "@/i18n";
import { format } from "@/i18n/date";
import { DateFormat, DayAction, Weekday } from "@/lib/enums";
import { formatPlaytime } from "@/lib/format";

const DAYS = 364;
const EMPTY: ActivityDay[] = [];
const NO_GAMES: ActivityGroup = { count: 0, games: [] };
// Days are counted in the viewer's own zone, like the grid
const ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const WEEKDAYS = Object.values(Weekday);
const ACTIONS = Object.values(DayAction);

// GitHub-style: one hue, four steps of intensity over the empty cell
const LEVEL_COLORS = [
  "#17181b",
  "rgba(255,43,43,.3)",
  "rgba(255,43,43,.5)",
  "rgba(255,43,43,.75)",
  "#ff2b2b",
];
const LEVELS = LEVEL_COLORS.map((_, i) => i);

interface DayRow {
  key: string;
  date: Date;
  week: number;
  weekday: string;
  /** 0 for an empty day, else the API's 1-4 */
  level: number;
  minutes: number;
  actions: Record<DayAction, ActivityGroup>;
}

/** The grid of the last 52 weeks; the API's active days fill it, the rest stay empty */
const useYear = (active: ActivityDay[]) =>
  useMemo(() => {
    const today = new Date();
    const gridStart = startOfWeek(subDays(today, DAYS - 1), { weekStartsOn: 1 });
    const byDay = new Map(active.map((d) => [d.date, d]));
    const days: DayRow[] = [];
    for (let i = 0; i < DAYS; i++) {
      const date = subDays(today, DAYS - 1 - i);
      const key = format(date, DateFormat.IsoDay);
      const day = byDay.get(key);
      days.push({
        key,
        date,
        week: Math.floor(differenceInCalendarDays(date, gridStart) / 7),
        weekday: WEEKDAYS[(date.getDay() + 6) % 7],
        level: day?.level ?? 0,
        minutes: day?.minutes ?? 0,
        actions: Object.fromEntries(ACTIONS.map((a) => [a, day?.[a] ?? NO_GAMES])) as Record<
          DayAction,
          ActivityGroup
        >,
      });
    }
    // Month names over the column where each month starts, GitHub-style; one squeezed into
    // the first two columns would collide with the next
    const weeks = days[days.length - 1].week + 1;
    const months = days
      .filter((d) => d.date.getDate() === 1 && d.week >= 2)
      .map((d) => ({ key: d.key, week: d.week, label: format(d.date, DateFormat.MonthShort) }));
    return { days, weeks, months };
  }, [active]);

/**
 * The profile header's year: one cell per day for the last 52 weeks, GitHub-style: the more happened, the redder. The
 * tooltip lists the day's actions with the games. TanStack Charts.
 */
export function YearInEvenings({ username, className }: { username: string; className?: string }) {
  const activity = useGetApiUserByUsernameActivity(username, { days: DAYS, tz: ZONE });
  const { days, weeks, months } = useYear(activity.data?.days ?? EMPTY);

  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

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
      {/* On a phone the year keeps readable cells and scrolls sideways, opened on the latest weeks */}
      <div ref={scroller} className="no-scrollbar overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="eyebrow relative h-4 normal-case tracking-normal">
            {months.map((m) => (
              <span
                key={m.key}
                className="absolute top-0"
                // The band scale leaves 18% of a step between columns; spread over the width
                style={{ left: `${(m.week / (weeks - 0.18)) * 100}%` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="mt-1 text-foreground">
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
      </div>
      <div className="eyebrow mt-1.5 flex items-center justify-end gap-1 normal-case tracking-normal">
        <span className="mr-1">{t("profile.evenings.less")}</span>
        {LEVEL_COLORS.map((color) => (
          <i key={color} className="inline-block size-2" style={{ background: color }} />
        ))}
        <span className="ml-1">{t("profile.evenings.more")}</span>
      </div>
    </div>
  );
}

/** A custom body replaces the built-in card, so it brings its own background and border */
function DayTip({ day }: { day: DayRow }) {
  const rows = ACTIONS.filter((a) => day.actions[a].count > 0);
  // Empty days get no tooltip at all
  if (rows.length === 0) return null;
  return (
    <div className="w-60 border border-white/30 bg-background px-2.5 py-1.5 font-sans text-xs font-normal">
      <div className="num font-bold">{format(day.date, DateFormat.WeekdayMonthDay)}</div>
      {rows.map((action) => {
        const { count, games } = day.actions[action];
        const rest = count - games.length;
        return (
          <div key={action} className="mt-1.5">
            <div className="font-bold">
              {action === DayAction.Played
                ? t("profile.evenings.tip.played", { time: formatPlaytime(day.minutes) })
                : t(`profile.evenings.tip.${action}`, { count })}
            </div>
            {games.map((g, i) => (
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
