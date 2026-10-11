import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { formatRating, ratingColor } from "@/lib/format";
import { statusMeta, type LibraryStatus } from "@/lib/statuses";
import { PillSize } from "@/lib/enums";

/** A personal 0–10 rating in the colour band of its value; renders nothing for 0/null */
export function RatingValue({
  value,
  className,
}: {
  value: number | null | undefined;
  className?: string;
}) {
  const text = formatRating(value);
  if (!text || value === null || value === undefined) return null;
  return <span className={cn("num font-extrabold", ratingColor(value), className)}>{text}</span>;
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
