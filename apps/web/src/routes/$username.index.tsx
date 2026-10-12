import { StatusEnum, useGetApiUserByUsernameReviews } from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Gamepad2Icon, HourglassIcon, MessageSquareTextIcon, Rows3Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { GameCard, GameRail } from "@/components/game/game-card";
import { PrivateNotice } from "@/components/profile/private-notice";
import { TierBoard } from "@/components/profile/tier-board";
import { Section } from "@/components/section";
import { ReviewCard } from "@/components/social/review-card";
import { SteamImportForm } from "@/components/steam/steam-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileContext } from "@/hooks/profile";
import { formatPlaytime } from "@/lib/format";
import { gradeOf } from "@/lib/grade";

export const Route = createFileRoute("/$username/")({
  component: ProfileOverview,
});

/** Overview tab: stats, the tier board, the year's activity, what's being played, latest reviews */
function ProfileOverview() {
  const { t } = useTranslation();
  const { username, entries, library, isPrivate, profile } = useProfileContext();
  const reviews = useGetApiUserByUsernameReviews(
    username,
    { limit: 3 },
    { query: { enabled: !isPrivate } },
  );
  const isOwn = !!profile.data?.isOwn;
  const [arranging, setArranging] = useState(false);

  if (isPrivate) return <PrivateNotice />;
  if (library.isPending) return <Skeleton className="h-40 rounded-card" />;

  const playing = entries.filter((e) => e.userGameData.status === StatusEnum.Playing).slice(0, 12);
  const mostPlayed = entries
    .filter((e) => e.userGameData.steamMinutes)
    .sort((a, b) => (b.userGameData.steamMinutes ?? 0) - (a.userGameData.steamMinutes ?? 0))
    .slice(0, 12);
  const recent = [...entries]
    .filter((e) => e.userGameData.endedAt)
    .sort((a, b) => (b.userGameData.endedAt ?? "").localeCompare(a.userGameData.endedAt ?? ""))
    .slice(0, 12);

  return (
    <>
      {entries.length > 0 && (
        <Section
          title={t("profile.overview.tiers")}
          icon={Rows3Icon}
          count={t("profile.tiers.count", {
            graded: entries.filter((e) => gradeOf(e.userGameData.rating)).length,
            total: entries.length,
          })}
          action={
            isOwn ? (
              <Button
                variant={arranging ? "default" : "secondary"}
                size="sm"
                onClick={() => setArranging((v) => !v)}
              >
                {arranging ? t("profile.tiers.done") : t("profile.tiers.arrange")}
              </Button>
            ) : undefined
          }
          className="mt-0"
        >
          <TierBoard entries={entries} arranging={isOwn && arranging} />
        </Section>
      )}

      {playing.length > 0 && (
        <Section
          title={t("profile.overview.nowPlaying")}
          icon={Gamepad2Icon}
          count={playing.length}
          className="mt-8"
        >
          <GameRail>
            {playing.map((g) => (
              <GameCard key={g.id} game={g} grade={gradeOf(g.userGameData.rating)} />
            ))}
          </GameRail>
        </Section>
      )}

      {mostPlayed.length > 0 && (
        <Section title={t("profile.overview.mostPlayed")} icon={HourglassIcon} className="mt-8">
          <GameRail>
            {mostPlayed.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                grade={gradeOf(g.userGameData.rating)}
                tag={formatPlaytime(g.userGameData.steamMinutes)}
              />
            ))}
          </GameRail>
        </Section>
      )}

      {recent.length > 0 && (
        <Section
          title={t("profile.overview.recentlyPlayed")}
          icon={Gamepad2Icon}
          action={
            <Link
              to="/$username/journal"
              params={{ username }}
              search={{ year: undefined }}
              className="text-sm text-dimmed hover:text-white"
            >
              {t("profile.overview.journal")}
            </Link>
          }
          className="mt-8"
        >
          <GameRail>
            {recent.map((g) => (
              <GameCard key={g.id} game={g} grade={gradeOf(g.userGameData.rating)} />
            ))}
          </GameRail>
        </Section>
      )}

      {reviews.data && reviews.data.results.length > 0 && (
        <Section
          title={t("profile.overview.recentlyReviewed")}
          icon={MessageSquareTextIcon}
          action={
            <Link
              to="/$username/reviews"
              params={{ username }}
              className="text-sm text-dimmed hover:text-white"
            >
              {t("profile.overview.allReviews")}
            </Link>
          }
          className="mt-8"
        >
          <div className="space-y-3">
            {reviews.data.results.map((review) => (
              <ReviewCard key={review.id} review={review} withGame />
            ))}
          </div>
        </Section>
      )}

      {entries.length === 0 &&
        (isOwn ? (
          <section className="panel p-6 sm:p-8">
            <h2 className="text-2xl">{t("steam.onboarding")}</h2>
            <div className="mt-4 max-w-xl">
              <SteamImportForm username={username} />
            </div>
          </section>
        ) : (
          <div className="panel mt-8 p-12 text-center text-dimmed">
            {t("profile.overview.empty")}
          </div>
        ))}
    </>
  );
}
