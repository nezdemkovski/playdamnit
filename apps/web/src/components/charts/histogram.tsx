import { barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useMemo } from "react";

import { t } from "@/i18n";

interface HistogramProps {
  /** Counts per 1..10 rating bucket */
  buckets: number[];
  /** Bucket (1-based) to paint in the accent colour, e.g. the viewer's own rating */
  highlight?: number | null;
  height?: number;
  ariaLabel: string;
  /** Which tooltip wording to use */
  noun?: "games" | "ratings";
}

const GREY = "rgba(241,241,240,.22)";
const RED = "#ff2b2b";

/** Rating distribution as ten bars, no axes, a tooltip with the bucket and its count */
export function Histogram({
  buckets,
  highlight,
  height = 44,
  ariaLabel,
  noun = "games",
}: HistogramProps) {
  const definition = useMemo(() => {
    const rows = buckets.map((count, i) => ({ bucket: i + 1, count, label: `${i + 1}` }));
    return defineChart(
      {
        marks: [
          barY(rows, {
            x: "bucket",
            y: "count",
            key: "bucket",
            fill: (row) => (row.bucket === highlight ? RED : GREY),
          }),
        ],
        scales: {
          x: { scale: () => scaleBand<number>().paddingInner(0.12), axis: false },
          y: { scale: scaleLinear().domain([0, Math.max(1, ...buckets)]), axis: false },
        },
      },
      {
        tooltip: {
          use: tooltip,
          format: (point) =>
            t(`histogram.${noun}`, { bucket: point.datum.bucket, count: point.datum.count }),
        },
      },
    );
  }, [buckets, highlight, noun]);
  return <Chart definition={definition} height={height} ariaLabel={ariaLabel} />;
}
