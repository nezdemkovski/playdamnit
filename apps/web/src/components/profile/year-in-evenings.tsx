import { cell, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { tooltip } from "@tanstack/charts/tooltip";
import {
  StatusEnum,
  useGetApiUserByUsernameSteamActivity,
  type UserGameWithUserData,
} from "@playdamnit/api-client";
import { differenceInCalendarDays, startOfWeek, subDays } from "date-fns";
import { cn } from "cn";
import { useMemo } from "react";

import { t } from "@/i18n";
import { format } from "@/i18n/date";
import { ActivityCell, DateFormat, Weekday } from "@/lib/enums";
import { formatPlaytime } from "@/lib/format";

const DAYS = 364;
const EMPTY: { date: string; minutes: number }[] = [];
const WEEKDAYS = Object.values(Weekday);

const CELL_RANK: Record<ActivityCell, number> = {
  [ActivityCell.None]: 0,
  [ActivityCell.Touched]: 1,
  [ActivityCell.Added]: 2,
  [ActivityCell.Played]: 3,
  [ActivityCell.Finished]: 4,
};
// Paint per bucket, in domain order; cells use the tokens through literal values the SVG understands
const CELL_COLORS = {
  [ActivityCell.None]: "#17181b",
  [ActivityCell.Touched]: "rgba(241,241,240,.35)",
  [ActivityCell.Added]: "rgba(255,43,43,.55)",
  [ActivityCell.Played]: "#f1f1f0",
  [ActivityCell.Finished]: "#d7ff3b",
};

interface DayRow {
  key: string;
  week: number;
  weekday: string;
  cell: ActivityCell;
  label: string;
}

const dayKey = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), DateFormat.IsoDay) : null;

const useYear = (entries: UserGameWithUserData[], played: { date: string; minutes: number }[]) =>
  useMemo(() => {
    const today = new Date();
    const first = subDays(today, DAYS - 1);
    const gridStart = startOfWeek(first, { weekStartsOn: 1 });
    const byDay = new Map<string, ActivityCell>();
    const bump = (key: string | null, cell: ActivityCell) => {
      if (!key) return;
      const prev = byDay.get(key);
      if (!prev || CELL_RANK[cell] > CELL_RANK[prev]) byDay.set(key, cell);
    };
    for (const e of entries) {
      const d = e.userGameData;
      bump(dayKey(d.addedAt), ActivityCell.Added);
      bump(dayKey(d.updatedAt), ActivityCell.Touched);
      if (d.status === StatusEnum.Finished) bump(dayKey(d.endedAt), ActivityCell.Finished);
    }
    const minutesByDay = new Map(played.map((p) => [p.date, p.minutes]));
    for (const p of played) bump(p.date, ActivityCell.Played);
    const days: DayRow[] = [];
    for (let i = 0; i < DAYS; i++) {
      const date = subDays(today, DAYS - 1 - i);
      const key = format(date, DateFormat.IsoDay);
      const cellValue = byDay.get(key) ?? ActivityCell.None;
      days.push({
        key,
        week: Math.floor(differenceInCalendarDays(date, gridStart) / 7),
        weekday: WEEKDAYS[(date.getDay() + 6) % 7],
        cell: cellValue,
        label: t("profile.evenings.dayLabel", {
          date: format(date, DateFormat.MonthDay),
          state:
            cellValue === ActivityCell.Played
              ? (formatPlaytime(minutesByDay.get(key)) ?? t("profile.evenings.cell.played"))
              : t(`profile.evenings.cell.${cellValue}`),
        }),
      });
    }
    return { days, first };
  }, [entries, played]);

/**
 * One cell per day for the last 52 weeks across the full width: added in red, finished in
 * green, otherwise touched in grey. TanStack Charts.
 */
export function YearInEvenings({
  username,
  entries,
}: {
  username: string;
  entries: UserGameWithUserData[];
}) {
  const activity = useGetApiUserByUsernameSteamActivity(username);
  const { days, first } = useYear(entries, activity.data?.days ?? EMPTY);
  const greenDays = days.filter((d) => d.cell === ActivityCell.Finished).length;

  const heat = useMemo(
    () =>
      defineChart(
        {
          marks: [
            cell(days, {
              x: "week",
              y: "weekday",
              color: "cell",
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
          color: {
            scale: scaleOrdinal<ActivityCell, string>(
              Object.values(ActivityCell),
              Object.values(ActivityCell).map((cell) => CELL_COLORS[cell]),
            ),
          },
        },
        { tooltip: { use: tooltip, format: (point) => point.datum.label } },
      ),
    [days],
  );

  return (
    <div className="border border-border">
      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg">
            {t("profile.evenings.title", { days: DAYS, green: greenDays })}
          </h3>
          <span className="eyebrow">
            {format(first, DateFormat.MonthYearShort)} →{" "}
            {format(new Date(), DateFormat.MonthYearShort)}
          </span>
        </div>
        <div className="mt-3 text-foreground">
          <Chart
            definition={heat}
            aspectRatio={53 / 7}
            initialWidth={640}
            ariaLabel={t("profile.evenings.heatAria")}
          />
        </div>
        <div className="eyebrow mt-2 flex flex-wrap gap-4 normal-case tracking-normal">
          <Legend color={CELL_COLORS[ActivityCell.Touched]}>
            {t("profile.evenings.cell.touched")}
          </Legend>
          <Legend color={CELL_COLORS[ActivityCell.Added]}>
            {t("profile.evenings.cell.added")}
          </Legend>
          <Legend color={CELL_COLORS[ActivityCell.Played]}>
            {t("profile.evenings.cell.played")}
          </Legend>
          <Legend color={CELL_COLORS[ActivityCell.Finished]}>
            {t("profile.evenings.cell.finished")}
          </Legend>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className={cn("inline-block size-2.5")} style={{ background: color }} />
      {children}
    </span>
  );
}
