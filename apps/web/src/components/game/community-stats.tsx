import type { GameCommunity } from "@playdamnit/api-client";
import { cn } from "cn";
import { useTranslation } from "react-i18next";

import { Histogram } from "@/components/charts/histogram";
import { STATUSES } from "@/lib/statuses";
import { ratingColor } from "@/lib/format";
import { HistogramNoun } from "@/lib/enums";

/** What members did with the game: average, histogram and status counts */
export function CommunityStats({
  community,
  mine,
  className,
}: {
  community: GameCommunity;
  /** The viewer's own rating, painted red in the histogram */
  mine?: number | null;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn("panel p-4 sm:p-5", className)}>
      <div className="flex items-end gap-4">
        <div>
          <div className="eyebrow">{t("community.rating")}</div>
          <div
            className={cn(
              "num mt-1 text-3xl font-extrabold",
              community.ratingAverage ? ratingColor(community.ratingAverage) : "text-dimmed",
            )}
          >
            {community.ratingAverage?.toFixed(1) ?? "–"}
          </div>
          <div className="text-xs text-dimmed">
            {t("community.ratings", { count: community.ratingCount })}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <Histogram
            buckets={community.histogram}
            highlight={mine ? Math.min(10, Math.max(1, Math.ceil(mine))) : null}
            height={56}
            ariaLabel={t("community.histogramLabel")}
            noun={HistogramNoun.Ratings}
          />
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
            <span className="text-dimmed">{t("community.mastered")}</span>{" "}
            <span className="font-semibold">{community.mastered}</span>
          </span>
        )}
        {community.total === 0 && <span className="text-dimmed">{t("community.nobody")}</span>}
      </div>
    </div>
  );
}
