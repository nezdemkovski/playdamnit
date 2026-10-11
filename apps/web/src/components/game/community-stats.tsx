import type { GameCommunity } from "@playdamnit/api-client";
import { cn } from "cn";

import { STATUSES } from "@/lib/statuses";
import { ratingColor } from "@/lib/format";

/** What members did with the game: average, histogram and status counts */
export function CommunityStats({
  community,
  className,
}: {
  community: GameCommunity;
  className?: string;
}) {
  const max = Math.max(1, ...community.histogram);
  return (
    <div className={cn("panel p-4 sm:p-5", className)}>
      <div className="flex items-end gap-4">
        <div>
          <div className="text-xs text-dimmed">Members' rating</div>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              community.ratingAverage ? ratingColor(community.ratingAverage) : "text-dimmed",
            )}
          >
            {community.ratingAverage?.toFixed(1) ?? "–"}
          </div>
          <div className="text-xs text-dimmed">{community.ratingCount} ratings</div>
        </div>
        <div className="flex h-14 flex-1 items-end gap-1" aria-label="Rating distribution">
          {community.histogram.map((n, i) => (
            <div
              key={i}
              title={`${i + 1}: ${n}`}
              className="flex-1 rounded-sm bg-white/15"
              style={{ height: `${Math.max(6, (n / max) * 100)}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {STATUSES.map((s) => {
          const n = community.statuses[s.value] ?? 0;
          if (!n) return null;
          const Icon = s.icon;
          return (
            <span key={s.value} className="flex items-center gap-1">
              <Icon className={cn("size-3.5", s.text)} />
              <span className="text-dimmed">{s.label}</span>
              <span className="font-semibold">{n}</span>
            </span>
          );
        })}
        {community.mastered > 0 && (
          <span>
            <span className="text-dimmed">Mastered</span>{" "}
            <span className="font-semibold">{community.mastered}</span>
          </span>
        )}
        {community.total === 0 && (
          <span className="text-dimmed">Nobody has logged this game yet.</span>
        )}
      </div>
    </div>
  );
}
