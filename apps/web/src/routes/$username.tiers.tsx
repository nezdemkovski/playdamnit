import type { UserGameWithUserData } from "@playdamnit/api-client";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { GameCard } from "@/components/game/game-card";
import { GradeBadge } from "@/components/game/rating";
import { PrivateNotice } from "@/components/profile/private-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileContext } from "@/hooks/profile";
import { PillSize } from "@/lib/enums";
import { GRADES, gradeOf } from "@/lib/grade";

export const Route = createFileRoute("/$username/tiers")({
  component: ProfileTiers,
});

const byName = (a: UserGameWithUserData, b: UserGameWithUserData) => a.name.localeCompare(b.name);

/** The library as a tier board: one row per grade, the ungraded rest underneath */
function ProfileTiers() {
  const { t } = useTranslation();
  const { entries, library, isOwn, isPrivate } = useProfileContext();
  const rows = useMemo(
    () =>
      GRADES.map((meta) => ({
        meta,
        games: entries
          .filter((e) => gradeOf(e.userGameData.rating) === meta.value)
          .toSorted(byName),
      })),
    [entries],
  );
  const ungraded = useMemo(
    () => entries.filter((e) => !gradeOf(e.userGameData.rating)).toSorted(byName),
    [entries],
  );

  if (isPrivate) return <PrivateNotice />;
  if (library.isPending) return <Skeleton className="h-96 rounded-card" />;

  const graded = entries.length - ungraded.length;

  return (
    <>
      <div className="eyebrow mb-3">
        {t("profile.tiers.summary", { graded, ungraded: ungraded.length })}
      </div>
      <div className="border border-border">
        {rows.map(({ meta, games }) => (
          <section
            key={meta.value}
            className="grid grid-cols-[80px_1fr] border-b border-border last:border-b-0 sm:grid-cols-[104px_1fr]"
            aria-label={meta.name}
          >
            <div className="flex flex-col items-center justify-center gap-1.5 border-r border-border bg-card p-2">
              <GradeBadge grade={meta.value} size={PillSize.Lg} className="sm:size-[4.5rem]" />
              <span className="num text-[11px] font-extrabold text-dimmed">{games.length}</span>
            </div>
            <div className="flex min-h-24 flex-wrap gap-1.5 p-1.5 sm:gap-2 sm:p-2">
              {games.length === 0 ? (
                <span className="self-center px-2 text-xs text-dimmed">
                  {t("profile.tiers.emptyRow")}
                </span>
              ) : (
                games.map((game) => (
                  <GameCard key={game.id} game={game} className="w-14 sm:w-[4.5rem]" />
                ))
              )}
            </div>
          </section>
        ))}
      </div>

      {ungraded.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-bold">
              {t("profile.tiers.ungraded")}{" "}
              <span className="num text-sm font-extrabold text-dimmed">{ungraded.length}</span>
            </h2>
            <span className="text-xs text-dimmed">
              {isOwn ? t("profile.tiers.ungradedHintOwn") : t("profile.tiers.ungradedHint")}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 sm:gap-2 md:grid-cols-10">
            {ungraded.map((game) => (
              <GameCard key={game.id} game={game} className="opacity-60 hover:opacity-100" />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
