import type { UserGameWithUserData } from "@playdamnit/api-client";
import { cn } from "cn";
import { useMemo } from "react";

import { Histogram } from "@/components/charts/histogram";
import { ratingColor } from "@/lib/format";
import { addedLine, backlogLine, finishedLine, playingLine, summarize } from "@/lib/voice";

/** Headline numbers in the scoreboard voice, the completion rate and the rating distribution */
export function ProfileStats({
  entries,
  own = false,
}: {
  entries: UserGameWithUserData[];
  own?: boolean;
}) {
  const s = useMemo(() => summarize(entries), [entries]);
  const ratings = useMemo(() => {
    const buckets = Array.from({ length: 10 }, () => 0);
    let rated = 0;
    let sum = 0;
    for (const e of entries) {
      const r = e.userGameData.rating;
      if (r) {
        rated++;
        sum += r;
        buckets[Math.min(9, Math.max(0, Math.ceil(r) - 1))]++;
      }
    }
    return { buckets, rated, average: rated ? sum / rated : 0, max: Math.max(1, ...buckets) };
  }, [entries]);

  return (
    <div className="border border-border">
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        <Stat
          label="Added"
          value={s.total}
          note={own ? addedLine(s) : `${s.addedThisWeek} this week`}
        />
        <Stat
          label="Finished"
          value={s.finished}
          tone={s.finished === 0 && s.total > 0 ? "bad" : undefined}
          note={own ? finishedLine(entries) : `${s.finishedThisMonth} this month`}
        />
        <Stat
          label='"Playing"'
          value={s.playing}
          note={own ? playingLine(s) : `${s.dropped} dropped`}
        />
        <Stat
          label="Backlog"
          value={s.backlog}
          note={own ? backlogLine(s) : `${s.dropped} dropped`}
        />
      </dl>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-border px-4 py-3 sm:px-5">
        <div>
          <div className="eyebrow">Completion</div>
          <div className="num mt-1 text-xl font-extrabold">
            {s.completion.toFixed(1)}
            <span className="text-sm text-dimmed">%</span>
          </div>
        </div>
        <div className="h-3 bg-card">
          <i
            className="block h-full bg-signal"
            style={{ width: `${Math.max(1, s.completion)}%` }}
          />
        </div>
        <div className={cn("eyebrow", s.completion < 25 ? "text-signal" : "text-done")}>
          {s.total === 0
            ? "nothing yet"
            : s.completion < 25
              ? "guilty"
              : s.completion < 60
                ? "working on it"
                : "respect"}
        </div>
      </div>
      {ratings.rated > 0 && (
        <div className="flex items-end gap-4 border-t border-border px-4 py-3 sm:px-5">
          <div className="shrink-0">
            <div className="eyebrow">Average</div>
            <div className={cn("num mt-1 text-xl font-extrabold", ratingColor(ratings.average))}>
              {ratings.average.toFixed(1)}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <Histogram buckets={ratings.buckets} ariaLabel="Rating distribution" />
          </div>
          <div className="eyebrow shrink-0">{ratings.rated} rated</div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: number;
  note: string;
  tone?: "bad";
}) {
  return (
    <div className="border-r border-border px-4 py-4 last:border-r-0 sm:px-5 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          "num my-1.5 text-4xl font-extrabold sm:text-5xl",
          tone === "bad" && "text-signal",
        )}
      >
        {value}
      </dd>
      <dd className="text-xs text-dimmed">{note}</dd>
    </div>
  );
}
