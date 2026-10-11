import type { UserGameWithUserData } from "@playdamnit/api-client";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { GradeBadge } from "@/components/game/rating";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PillSize } from "@/lib/enums";
import { gradeOf } from "@/lib/grade";
import { lastFinishLine, summarize } from "@/lib/voice";

/**
 * The profile's one fact and one taste signal: how much of the library is finished (the
 * guilt), and the typical grade (how generous). The owner also gets one line of voice.
 */
export function ProfileStatStrip({
  entries,
  own = false,
}: {
  entries: UserGameWithUserData[];
  own?: boolean;
}) {
  const { t } = useTranslation();
  const s = useMemo(() => summarize(entries), [entries]);
  // The median, not the mean: it is always a grade the person actually gave, and a mix of
  // S and F does not average out to a C nobody got
  const graded = useMemo(
    () =>
      entries
        .map((e) => e.userGameData.rating)
        .filter((r): r is number => !!r)
        .sort((a, b) => b - a),
    [entries],
  );
  const typicalGrade = graded.length ? gradeOf(graded[Math.floor((graded.length - 1) / 2)]) : null;

  return (
    <div className="flex items-center gap-6">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="num text-2xl leading-none font-extrabold">{s.finished}</span>
          <span className="num text-sm text-dimmed">/ {s.total}</span>
          <span className="eyebrow">{t("profile.stats.finished")}</span>
        </div>
        <div className="mt-2 h-1.5 bg-card">
          <i
            className="block h-full bg-signal"
            style={{ width: `${Math.max(1, s.completion)}%` }}
          />
        </div>
        {own && <p className="mt-2 text-xs text-dimmed">{lastFinishLine(entries)}</p>}
      </div>
      {typicalGrade && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex shrink-0 items-center gap-2">
              <span className="eyebrow">{t("profile.stats.typical")}</span>
              <GradeBadge grade={typicalGrade} size={PillSize.Md} className="block" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("profile.stats.typicalTip", { count: graded.length })}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
