import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { formatRating, ratingColor } from "@/lib/format";
import { statusMeta, type LibraryStatus } from "@/lib/statuses";

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
  return (
    <span className={cn("font-bold tabular-nums", ratingColor(value), className)}>{text}</span>
  );
}

/** Status pill: tinted background, dark text, status icon */
export function StatusPill({
  status,
  className,
  size = "sm",
}: {
  status: LibraryStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  return (
    <Badge
      className={cn(
        "gap-1 border-0 text-black",
        meta.bg,
        size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs",
        className,
      )}
    >
      {meta.label}
      <Icon className={size === "md" ? "size-3.5" : "size-3"} strokeWidth={2.5} />
    </Badge>
  );
}
