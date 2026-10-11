import type { UserGameWithUserData } from "@playdamnit/api-client";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { GradeBadge } from "@/components/game/rating";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { typicalGrade } from "@/lib/grade";
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
  const graded = useMemo(() => entries.filter((e) => e.userGameData.rating).length, [entries]);
  const typical = useMemo(() => typicalGrade(entries.map((e) => e.userGameData.rating)), [entries]);

  const finished = (
    <span className="flex items-center gap-2">
      <span>
        <b>{s.finished}</b>
        <span className="text-dimmed">
          {" "}
          / {s.total} {t("profile.stats.finished")}
        </span>
      </span>
      <span className="h-1 w-14 bg-card">
        <i className="block h-full bg-signal" style={{ width: `${Math.max(2, s.completion)}%` }} />
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
      {typical && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex cursor-default items-center gap-1.5">
              <span className="text-dimmed">{t("profile.stats.typical")}</span>
              <GradeBadge grade={typical} className="block size-6" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("profile.stats.typicalTip", { count: graded })}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
