import { areaY, cell, defineChart, lineY } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { scaleOrdinal } from "@tanstack/charts/scales/ordinal";
import { scalePoint } from "@tanstack/charts/scales/point";
import { tooltip } from "@tanstack/charts/tooltip";
import type { UserGameWithUserData } from "@playdamnit/api-client";
import { differenceInCalendarDays, format, startOfWeek, subDays } from "date-fns";
import { cn } from "cn";
import { useMemo } from "react";

const DAYS = 364;
const MONTHS = 12;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Cell = "none" | "touched" | "added" | "finished";
const CELL_RANK: Record<Cell, number> = { none: 0, touched: 1, added: 2, finished: 3 };
// Paint per bucket, in domain order; cells use the tokens through literal values the SVG understands
const CELL_COLORS = {
  none: "#17181b",
  touched: "rgba(241,241,240,.35)",
  added: "rgba(255,43,43,.55)",
  finished: "#d7ff3b",
};

interface DayRow {
  key: string;
  week: number;
  weekday: string;
  cell: Cell;
  label: string;
}

interface MonthRow {
  index: number;
  month: string;
  added: number;
  finished: number;
}

const dayKey = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "yyyy-MM-dd") : null;
const monthKey = (iso: string | null | undefined) =>
  iso ? format(new Date(iso), "yyyy-MM") : null;

const useYear = (entries: UserGameWithUserData[]) =>
  useMemo(() => {
    const today = new Date();
    const first = subDays(today, DAYS - 1);
    const gridStart = startOfWeek(first, { weekStartsOn: 1 });
    const byDay = new Map<string, Cell>();
    const bump = (key: string | null, cell: Cell) => {
      if (!key) return;
      const prev = byDay.get(key);
      if (!prev || CELL_RANK[cell] > CELL_RANK[prev]) byDay.set(key, cell);
    };
    const addedByMonth = new Map<string, number>();
    const finishedByMonth = new Map<string, number>();
    for (const e of entries) {
      const d = e.userGameData;
      bump(dayKey(d.addedAt), "added");
      bump(dayKey(d.updatedAt), "touched");
      if (d.status === "finished") bump(dayKey(d.endedAt), "finished");
      const am = monthKey(d.addedAt);
      if (am) addedByMonth.set(am, (addedByMonth.get(am) ?? 0) + 1);
      const fm = d.status === "finished" ? monthKey(d.endedAt) : null;
      if (fm) finishedByMonth.set(fm, (finishedByMonth.get(fm) ?? 0) + 1);
    }
    const days: DayRow[] = [];
    for (let i = 0; i < DAYS; i++) {
      const date = subDays(today, DAYS - 1 - i);
      const key = format(date, "yyyy-MM-dd");
      const cellValue = byDay.get(key) ?? "none";
      days.push({
        key,
        week: Math.floor(differenceInCalendarDays(date, gridStart) / 7),
        weekday: WEEKDAYS[(date.getDay() + 6) % 7],
        cell: cellValue,
        label: `${format(date, "MMM d")} · ${cellValue}`,
      });
    }
    const months: MonthRow[] = [];
    for (let i = MONTHS - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const m = format(d, "yyyy-MM");
      months.push({
        index: months.length,
        month: format(d, "MMM"),
        added: addedByMonth.get(m) ?? 0,
        finished: finishedByMonth.get(m) ?? 0,
      });
    }
    return { days, months, first };
  }, [entries]);

/**
 * One cell per day for the last 52 weeks (added in red, finished in green, otherwise touched
 * in grey) and a 12-month chart of games added against games finished. TanStack Charts.
 */
export function YearInEvenings({ entries }: { entries: UserGameWithUserData[] }) {
  const { days, months, first } = useYear(entries);
  const greenDays = days.filter((d) => d.cell === "finished").length;
  const totalAdded = months.reduce((s, m) => s + m.added, 0);
  const totalFinished = months.reduce((s, m) => s + m.finished, 0);

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
            scale: scaleOrdinal<Cell, string>(
              ["none", "touched", "added", "finished"],
              [CELL_COLORS.none, CELL_COLORS.touched, CELL_COLORS.added, CELL_COLORS.finished],
            ),
          },
        },
        { tooltip: { use: tooltip, format: (point) => point.datum.label } },
      ),
    [days],
  );

  const trend = useMemo(
    () =>
      defineChart(
        {
          marks: [
            areaY(months, { x: "index", y: "added", fill: "#ff2b2b", fillOpacity: 0.12 }),
            lineY(months, { x: "index", y: "added", stroke: "#ff2b2b", strokeWidth: 2 }),
            lineY(months, { x: "index", y: "finished", stroke: "#d7ff3b", strokeWidth: 2 }),
          ],
          scales: {
            x: {
              scale: scalePoint,
              axis: {
                ticks: {
                  size: 0,
                  // Every other month label, so they never run into each other
                  format: (value: number) => (value % 2 === 0 ? (months[value]?.month ?? "") : ""),
                },
              },
            },
            y: { scale: scaleLinear, nice: true, grid: true, axis: { ticks: { size: 0 } } },
          },
        },
        {
          tooltip: {
            use: tooltip,
            format: (point) =>
              `${point.datum.month} · ${point.datum.added} added · ${point.datum.finished} finished`,
          },
        },
      ),
    [months],
  );

  return (
    <div className="grid gap-px border border-border bg-border md:grid-cols-[1.4fr_1fr]">
      <div className="bg-background p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-lg">
            {DAYS} days. {greenDays} of them green.
          </h3>
          <span className="eyebrow">
            {format(first, "MMM yyyy")} → {format(new Date(), "MMM yyyy")}
          </span>
        </div>
        <div className="mt-3 text-foreground">
          <Chart
            definition={heat}
            aspectRatio={53 / 7}
            initialWidth={640}
            ariaLabel="Days with activity over the last year"
          />
        </div>
        <div className="eyebrow mt-2 flex flex-wrap gap-4 normal-case tracking-normal">
          <Legend color={CELL_COLORS.none}>nothing</Legend>
          <Legend color={CELL_COLORS.touched}>touched</Legend>
          <Legend color={CELL_COLORS.added}>added</Legend>
          <Legend color={CELL_COLORS.finished}>finished</Legend>
        </div>
      </div>
      <div className="bg-background p-5">
        <div className="eyebrow">Added vs finished · 12 months</div>
        <div className="mt-2 text-dimmed [&_text]:fill-current [&_text]:font-mono [&_text]:text-[10px]">
          <Chart
            definition={trend}
            height={150}
            ariaLabel="Games added versus games finished per month"
          />
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr_auto] items-baseline gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-dimmed">Added</dt>
          <dd className="border-b border-dotted border-border" />
          <dd className="num font-extrabold text-signal">{totalAdded}</dd>
          <dt className="text-dimmed">Finished</dt>
          <dd className="border-b border-dotted border-border" />
          <dd className="num font-extrabold text-done">{totalFinished}</dd>
        </dl>
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
