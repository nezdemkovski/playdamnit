import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Grade, PillSize } from "@/lib/enums";
import { gradeMeta } from "@/lib/grade";
import { statusMeta, type LibraryStatus } from "@/lib/statuses";

const SEAL_SIZE: Record<PillSize, string> = {
  [PillSize.Sm]: "size-8",
  [PillSize.Md]: "size-10",
  [PillSize.Lg]: "size-14",
  [PillSize.Xl]: "size-24",
};

// The letter, in viewBox units. Archivo Black's capitals are about 0.72em tall, so the
// baseline sits that far below the centre: every letter's cap box is centred, whatever the
// browser does with "central" baselines.
const LETTER_SIZE = 46;
const LETTER_BASELINE = 50 + (LETTER_SIZE * 0.72) / 2;

/**
 * Twelve soft lobes around a 100×100 box: the seal's outline. Radius leaves room for the
 * rims (up to 7 units outside the path) so nothing is drawn past the box and gets clipped.
 */
const SCALLOPS = (() => {
  const lobes = 12;
  const points: string[] = [];
  for (let i = 0; i < lobes * 8; i++) {
    const a = (Math.PI * 2 * i) / (lobes * 8);
    const r = 38.5 + 4 * Math.cos(lobes * a);
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
  onArt = false,
}: {
  grade: Grade | null | undefined;
  size?: PillSize;
  className?: string;
  /** Play the "pressed on" animation (the moment of giving the grade) */
  pressed?: boolean;
  /** Add the light outer rim: for seals that sit on cover art, not on a dark panel */
  onArt?: boolean;
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
      <svg viewBox="0 0 100 100" className="block size-full" aria-hidden="true">
        <g className={cn("origin-center", pressed && "seal-spin")}>
          {/* On art: a light rim outside the dark one, so the seal separates from any cover */}
          {onArt && (
            <polygon
              points={SCALLOPS}
              fill="none"
              stroke="var(--foreground)"
              strokeWidth="14"
              strokeLinejoin="round"
              opacity="0.9"
            />
          )}
          <polygon
            points={SCALLOPS}
            fill="currentColor"
            stroke="var(--background)"
            strokeWidth="8"
            strokeLinejoin="round"
          />
        </g>
        <text
          x="50"
          y={LETTER_BASELINE}
          textAnchor="middle"
          fontSize={LETTER_SIZE}
          fill={meta.ink}
          className="font-display"
        >
          {grade}
        </text>
      </svg>
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
