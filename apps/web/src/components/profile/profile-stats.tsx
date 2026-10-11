import type { UserGameWithUserData } from "@playdamnit/api-client";
import { cn } from "cn";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Histogram } from "@/components/charts/histogram";
import { GradeBadge } from "@/components/game/rating";
import { PillSize, StatTone } from "@/lib/enums";
import { gradeCounts, gradeOf } from "@/lib/grade";
import { addedLine, backlogLine, finishedLine, playingLine, summarize } from "@/lib/voice";

/** Headline numbers in the scoreboard voice, the completion rate and the rating distribution */
export function ProfileStats({
  entries,
  own = false,
}: {
  entries: UserGameWithUserData[];
  own?: boolean;
}) {
  const { t } = useTranslation();
  const s = useMemo(() => summarize(entries), [entries]);
  const ratings = useMemo(() => {
    const values = entries.map((e) => e.userGameData.rating).filter((r): r is number => !!r);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      counts: gradeCounts(values),
      rated: values.length,
      average: values.length ? sum / values.length : 0,
    };
  }, [entries]);

  return (
    <div className="border border-border">
      <dl className="grid grid-cols-2 sm:grid-cols-4">
        <Stat
          label={t("profile.stats.added")}
          value={s.total}
          note={own ? addedLine(s) : t("profile.stats.addedThisWeek", { count: s.addedThisWeek })}
        />
        <Stat
          label={t("profile.stats.finished")}
          value={s.finished}
          tone={s.finished === 0 && s.total > 0 ? StatTone.Bad : undefined}
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
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-t border-border px-4 py-3 sm:px-5">
        <div>
          <div className="eyebrow">{t("profile.stats.completion")}</div>
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
            ? t("profile.stats.nothingYet")
            : s.completion < 25
              ? t("profile.stats.guilty")
              : s.completion < 60
                ? t("profile.stats.workingOnIt")
                : t("profile.stats.respect")}
        </div>
      </div>
      {ratings.rated > 0 && (
        <div className="flex items-end gap-4 border-t border-border px-4 py-3 sm:px-5">
          <div className="shrink-0">
            <div className="eyebrow">{t("profile.stats.average")}</div>
            <div className="mt-1">
              <GradeBadge grade={gradeOf(ratings.average)} size={PillSize.Md} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <Histogram counts={ratings.counts} ariaLabel={t("profile.stats.distribution")} />
          </div>
          <div className="eyebrow shrink-0">
            {t("profile.stats.rated", { count: ratings.rated })}
          </div>
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
  tone?: StatTone;
}) {
  return (
    <div className="border-r border-border px-4 py-4 last:border-r-0 sm:px-5 [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          "num my-1.5 text-4xl font-extrabold sm:text-5xl",
          tone === StatTone.Bad && "text-signal",
        )}
      >
        {value}
      </dd>
      <dd className="text-xs text-dimmed">{note}</dd>
    </div>
  );
}
