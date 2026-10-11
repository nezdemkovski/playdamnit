import { cn } from "cn";
import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { Grade, PillSize } from "@/lib/enums";
import { gradeMeta } from "@/lib/grade";
import { statusMeta, type LibraryStatus } from "@/lib/statuses";

const SEAL_SIZE: Record<PillSize, string> = {
  [PillSize.Sm]: "size-7",
  [PillSize.Md]: "size-9",
  [PillSize.Lg]: "size-14",
  [PillSize.Xl]: "size-24",
};

/** The ring text: the verdict repeated around the letter until the circle is full */
const RING_CHARS = 29;
const ringText = (name: string) => {
  const unit = t("grade.ring", { name });
  let text = unit;
  while (text.length + unit.length <= RING_CHARS) text += unit;
  return text;
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
  // Small seals drop the fine notches and the inner hairline: they turn to mush under 40px
  const small = !withText;
  const inner = meta.filled
    ? "currentColor"
    : grade === Grade.F
      ? `url(#${id}h)`
      : "var(--background)";
  const ink = meta.filled ? "#000" : "currentColor";
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
        {small && <circle cx="50" cy="50" r="50" fill="var(--background)" />}
        <g className={cn("origin-center", pressed && "seal-spin")}>
          <circle
            cx="50"
            cy="50"
            r={small ? 43 : 45}
            fill="none"
            stroke="currentColor"
            strokeWidth={small ? 11 : 8.5}
            strokeDasharray={small ? "3.4 2.6" : "1.6 1.9"}
          />
          <circle
            cx="50"
            cy="50"
            r={small ? 34 : 37}
            fill={inner}
            stroke="currentColor"
            strokeWidth={small ? 3 : 1.2}
          />
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
                <textPath href={`#${id}p`}>{ringText(meta.name)}</textPath>
              </text>
            </>
          )}
        </g>
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={withText ? 36 : 48}
          fill={ink}
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
