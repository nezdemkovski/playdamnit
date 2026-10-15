import type { LibraryIndexItem, ProfileStats } from "@playdamnit/api-client";
import { useTranslation } from "react-i18next";

import { GradeBadge } from "@/components/game/rating";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { lastFinishLine } from "@/lib/voice";

/**
 * The profile's one fact and one taste signal, inline with the follower counts: how much of
 * the library is finished (the guilt) and the typical grade (how generous), both from the API.
 * The owner gets one line of voice on hover.
 */
export function ProfileStatStrip({
  stats,
  entries,
  own = false,
}: {
  stats: ProfileStats;
  /** The owner's library, for the voice line */
  entries?: LibraryIndexItem[];
  own?: boolean;
}) {
  const { t } = useTranslation();

  const finished = (
    <span>
      <b>{stats.finished}</b>
      <span className="text-dimmed">
        {" "}
        / {stats.total} {t("profile.stats.finished")}
      </span>
    </span>
  );

  return (
    <>
      {/* The owner gets the voice line on hover; visitors just get the fraction */}
      {own && entries ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">{finished}</span>
          </TooltipTrigger>
          <TooltipContent>{lastFinishLine(entries)}</TooltipContent>
        </Tooltip>
      ) : (
        finished
      )}
      {stats.typicalGrade && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex cursor-default items-center gap-1.5">
              <span className="text-dimmed">{t("profile.stats.typical")}</span>
              <GradeBadge grade={stats.typicalGrade} className="block size-6" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("profile.stats.typicalTip", { count: stats.graded })}</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
