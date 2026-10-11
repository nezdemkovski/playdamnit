import { cn } from "cn";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { Grade, PillSize } from "@/lib/enums";
import { gradeMeta } from "@/lib/grade";
import { statusMeta, type LibraryStatus } from "@/lib/statuses";

const SEAL_SIZE: Record<PillSize, string> = {
  [PillSize.Sm]: "size-6",
  [PillSize.Md]: "size-9",
  [PillSize.Lg]: "size-14",
  [PillSize.Xl]: "size-24",
};

/**
 * A grade as a seal: notched ring, the verdict running around the letter (from Lg up).
 * The only round thing in the app, on purpose. Renders nothing when there is no grade.
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
  const id = useId();
  if (!grade) return null;
  const meta = gradeMeta(grade);
  const withText = size === PillSize.Lg || size === PillSize.Xl;
  const inner = meta.filled
    ? "currentColor"
    : grade === Grade.F
      ? `url(#${id}h)`
      : "var(--background)";
  const ink = meta.filled ? "#000" : "currentColor";
  const ring = t("grade.ring", { name: meta.name, grade });
  return (
    <span
      title={meta.name}
      className={cn(
        "relative inline-block shrink-0 select-none",
        SEAL_SIZE[size],
        meta.color,
        pressed && "seal-in",
        className,
      )}
    >
      <svg viewBox="0 0 100 100" className="block size-full overflow-visible" aria-hidden="true">
        {grade === Grade.F && (
          <pattern
            id={`${id}h`}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="6" height="6" fill="var(--background)" />
            <rect width="2" height="6" fill="currentColor" opacity="0.3" />
          </pattern>
        )}
        <g className={cn("origin-center", pressed && "seal-spin")}>
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth={withText ? 8.5 : 9.5}
            strokeDasharray="1.6 1.9"
          />
          <circle cx="50" cy="50" r="37" fill={inner} stroke="currentColor" strokeWidth="1.2" />
          {withText && (
            <>
              <path
                id={`${id}p`}
                d="M50,50 m-29,0 a29,29 0 1,1 58,0 a29,29 0 1,1 -58,0"
                fill="none"
              />
              <text
                className="font-mono font-extrabold uppercase"
                fontSize="7.2"
                letterSpacing="0.22em"
                fill={ink}
              >
                <textPath href={`#${id}p`}>{ring}</textPath>
              </text>
            </>
          )}
        </g>
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={withText ? 36 : 46}
          fill={ink}
          className="font-display"
        >
          {grade}
        </text>
      </svg>
      {pressed && (
        <i className="seal-pulse pointer-events-none absolute -inset-1.5 rounded-full border-2 border-current" />
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
