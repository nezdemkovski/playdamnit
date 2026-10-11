import type { UserGameWithUserData } from "@playdamnit/api-client";
import { cn } from "cn";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { GradeBadge } from "@/components/game/rating";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { gradeOf } from "@/lib/grade";
import { addedLine, backlogLine, finishedLine, playingLine, summarize } from "@/lib/voice";

/**
 * The scoreboard as one strip for the profile header: four numbers (the voice line in a
 * tooltip), the completion bar with its verdict, and the typical (median) grade.
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
  const guilty = s.completion < 25;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
      <dl className="flex gap-6">
        <Stat
          label={t("profile.stats.added")}
          value={s.total}
          note={own ? addedLine(s) : t("profile.stats.addedThisWeek", { count: s.addedThisWeek })}
        />
        <Stat
          label={t("profile.stats.finished")}
          value={s.finished}
          bad={s.finished === 0 && s.total > 0}
          note={
            own
              ? finishedLine(entries)
              : t("profile.stats.finishedThisMonth", { count: s.finishedThisMonth })
          }
        />
        <Stat
          label={t("profile.stats.playing")}
          value={s.playing}
          note={own ? playingLine(s) : t("profile.stats.dropped", { count: s.dropped })}
        />
        <Stat
          label={t("profile.stats.backlog")}
          value={s.backlog}
          note={own ? backlogLine(s) : t("profile.stats.dropped", { count: s.dropped })}
        />
      </dl>
      <div className="min-w-48 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="eyebrow">{t("profile.stats.completion")}</span>
          <span className={cn("eyebrow", guilty ? "text-signal" : "text-done")}>
            {s.total === 0
              ? t("profile.stats.nothingYet")
              : guilty
                ? t("profile.stats.guilty")
                : s.completion < 60
                  ? t("profile.stats.workingOnIt")
                  : t("profile.stats.respect")}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-1.5 flex-1 bg-card">
            <i
              className="block h-full bg-signal"
              style={{ width: `${Math.max(1, s.completion)}%` }}
            />
          </div>
          <span className="num text-sm font-extrabold">
            {s.completion.toFixed(1)}
            <span className="text-dimmed">%</span>
          </span>
        </div>
      </div>
      {typicalGrade && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-2">
              <span className="eyebrow">{t("profile.stats.typical")}</span>
              <GradeBadge grade={typicalGrade} className="block" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("profile.stats.typicalTip", { count: graded.length })}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  note,
  bad,
}: {
  label: string;
  value: number;
  note: string;
  bad?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-default">
          <dt className="eyebrow">{label}</dt>
          <dd className={cn("num text-2xl leading-tight font-extrabold", bad && "text-signal")}>
            {value}
          </dd>
        </div>
      </TooltipTrigger>
      <TooltipContent>{note}</TooltipContent>
    </Tooltip>
  );
}
