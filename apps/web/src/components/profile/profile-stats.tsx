import type { UserGameWithUserData } from "@playdamnit/api-client";
import { useMemo } from "react";

import { ratingColor } from "@/lib/format";

const thisYear = new Date().getFullYear();

/** Headline numbers and the rating distribution of a library */
export function ProfileStats({ entries }: { entries: UserGameWithUserData[] }) {
  const stats = useMemo(() => {
    let played = 0;
    let playedThisYear = 0;
    let backlog = 0;
    let rated = 0;
    let sum = 0;
    const buckets = Array.from({ length: 10 }, () => 0);
    for (const entry of entries) {
      const { status, rating, endedAt } = entry.userGameData;
      if (
        status === "finished" ||
        status === "dropped" ||
        status === "playing" ||
        status === "online"
      )
        played++;
      if (endedAt && new Date(endedAt).getFullYear() === thisYear) playedThisYear++;
      if (status === "backlog" || status === "want_to_play") backlog++;
      if (rating) {
        rated++;
        sum += rating;
        buckets[Math.min(9, Math.max(0, Math.ceil(rating) - 1))]++;
      }
    }
    return {
      played,
      playedThisYear,
      backlog,
      rated,
      average: rated ? sum / rated : 0,
      buckets,
      max: Math.max(1, ...buckets),
    };
  }, [entries]);

  return (
    <div className="panel p-5">
      <dl className="grid grid-cols-3 gap-4">
        <Stat label="Games played" value={stats.played} />
        <Stat label={`Played in ${thisYear}`} value={stats.playedThisYear} />
        <Stat label="Backlog" value={stats.backlog} />
      </dl>
      {stats.rated > 0 && (
        <div className="mt-5 flex items-end gap-4">
          <div className="shrink-0">
            <div className="text-xs text-dimmed">Average</div>
            <div className={`text-2xl font-bold tabular-nums ${ratingColor(stats.average)}`}>
              {stats.average.toFixed(1)}
            </div>
          </div>
          <div className="flex h-12 flex-1 items-end gap-1" aria-label="Rating distribution">
            {stats.buckets.map((count, i) => (
              <div
                key={i}
                title={`${i + 1}: ${count}`}
                className="flex-1 rounded-sm bg-white/15 transition-colors hover:bg-white/30"
                style={{ height: `${Math.max(8, (count / stats.max) * 100)}%` }}
              />
            ))}
          </div>
          <div className="shrink-0 text-xs text-dimmed">{stats.rated} rated</div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-dimmed">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums">{String(value).padStart(3, "0")}</dd>
    </div>
  );
}
