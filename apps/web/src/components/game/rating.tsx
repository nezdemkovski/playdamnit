import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Grade, PillSize } from "@/lib/enums";
import { gradeMeta } from "@/lib/grade";
import { statusMeta, type LibraryStatus } from "@/lib/statuses";

const SEAL_SIZE: Record<PillSize, string> = {
  [PillSize.Sm]: "size-7",
  [PillSize.Md]: "size-9",
  [PillSize.Lg]: "size-14",
  [PillSize.Xl]: "size-24",
};

const LETTER_SIZE: Record<PillSize, number> = {
  [PillSize.Sm]: 50,
  [PillSize.Md]: 48,
  [PillSize.Lg]: 46,
  [PillSize.Xl]: 46,
};

/** Twelve soft lobes around a 100×100 box: the seal's outline */
const SCALLOPS = (() => {
  const lobes = 12;
  const points: string[] = [];
  for (let i = 0; i < lobes * 8; i++) {
    const a = (Math.PI * 2 * i) / (lobes * 8);
    const r = 43 + 4.5 * Math.cos(lobes * a);
    points.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return points.join(" ");
})();

/**
 * A grade as a scalloped seal in its metal (platinum for S down to bronze, iron for D, red
 * for F) with a dark edge so it sits on any cover. Renders nothing when there is no grade.
 */
export function GradeBadge({
  grade,
  size = PillSize.Sm,
  className,
  pressed = false,
}: {
  grade: Grade | null | undefined;
  size?: PillSize;
  className?: string;
  /** Play the "pressed on" animation (the moment of giving the grade) */
  pressed?: boolean;
}) {
  if (!grade) return null;
  const meta = gradeMeta(grade);
  return (
    <span
      title={meta.name}
      className={cn(
        "relative inline-block shrink-0 select-none",
        SEAL_SIZE[size],
        pressed && "seal-in",
        className,
      )}
      style={{ color: meta.fill }}
    >
      <svg viewBox="0 0 100 100" className="block size-full overflow-visible" aria-hidden="true">
        <polygon
          points={SCALLOPS}
          fill="currentColor"
          stroke="var(--background)"
          strokeWidth="5"
          strokeLinejoin="round"
          className={cn("origin-center", pressed && "seal-spin")}
        />
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={LETTER_SIZE[size]}
          fill={meta.ink}
          className="font-display"
        >
          {grade}
        </text>
      </svg>
      {pressed && (
        <i
          className="seal-pulse pointer-events-none absolute -inset-1.5 border-2 border-current"
          style={{ borderRadius: "50%" }}
        />
      )}
    </span>
  );
}

/** Status chip: square, mono, filled for finished/playing, outlined in its colour otherwise */
export function StatusPill({
  status,
  className,
  size = PillSize.Sm,
}: {
  status: LibraryStatus;
  className?: string;
  size?: PillSize;
}) {
  const meta = statusMeta(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 bg-transparent",
        meta.chip,
        size === PillSize.Md ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5",
        className,
      )}
    >
      {meta.label}
    </Badge>
  );
}
