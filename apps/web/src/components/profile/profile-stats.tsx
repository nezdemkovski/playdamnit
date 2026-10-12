import type { UserGameWithUserData } from "@playdamnit/api-client";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { GradeBadge } from "@/components/game/rating";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { gradeOf } from "@/lib/grade";
import { lastFinishLine, summarize } from "@/lib/voice";

/**
 * The profile's one fact and one taste signal, inline with the follower counts: how much of
 * the library is finished (the guilt) and the typical grade (how generous). The owner gets
 * one line of voice on hover.
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

  const finished = (
    <span>
      <b>{s.finished}</b>
      <span className="text-dimmed">
        {" "}
        / {s.total} {t("profile.stats.finished")}
      </span>
    </span>
  );

  return (
    <>
      {/* The owner gets the voice line on hover; visitors just get the fraction */}
      {own ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">{finished}</span>
          </TooltipTrigger>
          <TooltipContent>{lastFinishLine(entries)}</TooltipContent>
        </Tooltip>
      ) : (
        finished
      )}
      {typicalGrade && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex cursor-default items-center gap-1.5">
              <span className="text-dimmed">{t("profile.stats.typical")}</span>
              <GradeBadge grade={typicalGrade} className="block size-6" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("profile.stats.typicalTip", { count: graded.length })}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
