import { barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { cn } from "cn";
import { useMemo } from "react";

import { t } from "@/i18n";
import { Grade, HistogramNoun } from "@/lib/enums";
import { GRADES } from "@/lib/grade";

interface HistogramProps {
  /** One count per grade, in GRADES order (S first) */
  counts: number[];
  /** The grade to paint in the accent colour, e.g. the viewer's own */
  highlight?: Grade | null;
  height?: number;
  ariaLabel: string;
  /** Which tooltip wording to use */
  noun?: HistogramNoun;
}

const GREY = "rgba(241,241,240,.22)";
const RED = "#ff2b2b";

/** Grade distribution: one bar per grade with its letter underneath, a tooltip with the count */
export function Histogram({
  counts,
  highlight,
  height = 44,
  ariaLabel,
  noun = HistogramNoun.Games,
}: HistogramProps) {
  const definition = useMemo(() => {
    const rows = GRADES.map((g, i) => ({ grade: g.value, count: counts[i] ?? 0 }));
    return defineChart(
      {
        marks: [
          barY(rows, {
            x: "grade",
            y: "count",
            key: "grade",
            fill: (row) => (row.grade === highlight ? RED : GREY),
          }),
        ],
        scales: {
          x: { scale: () => scaleBand<Grade>().paddingInner(0.18), axis: false },
          y: { scale: scaleLinear().domain([0, Math.max(1, ...counts)]), axis: false },
        },
      },
      {
        tooltip: {
          use: tooltip,
          format: (point) =>
            t(`histogram.${noun}`, { grade: point.datum.grade, count: point.datum.count }),
        },
      },
    );
  }, [counts, highlight, noun]);
  return (
    <div>
      <Chart definition={definition} height={height} ariaLabel={ariaLabel} />
      <div className="mt-1 grid grid-cols-6 text-center">
        {GRADES.map((g) => (
          <span
            key={g.value}
            className={cn(
              "num text-[10px] font-extrabold",
              g.value === highlight ? "text-signal" : "text-dimmed",
            )}
          >
            {g.value}
          </span>
        ))}
      </div>
    </div>
  );
}
