import { useGetApiUserByUsernameReviews } from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AwardIcon, Gamepad2Icon, MessageSquareTextIcon } from "lucide-react";
import { useMemo } from "react";

import { GameCard, GameRail } from "@/components/game/game-card";
import { Badges, computeBadges } from "@/components/profile/badges";
import { PrivateNotice } from "@/components/profile/private-notice";
import { ProfileStats } from "@/components/profile/profile-stats";
import { Section } from "@/components/section";
import { ReviewCard } from "@/components/social/review-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileContext } from "@/hooks/profile";

export const Route = createFileRoute("/$username/")({
  component: ProfileOverview,
});

/** Overview tab: stats, badges, what's being played, latest reviews */
function ProfileOverview() {
  const { username, entries, library, isPrivate, profile } = useProfileContext();
  const reviews = useGetApiUserByUsernameReviews(
    username,
    { limit: 3 },
    { query: { enabled: !isPrivate } },
  );
  const badges = useMemo(
    () => computeBadges(entries, profile.data?.counts.reviews ?? 0),
    [entries, profile.data],
  );

  if (isPrivate) return <PrivateNotice />;
  if (library.isPending) return <Skeleton className="h-40 rounded-card" />;

  const playing = entries.filter((e) => e.userGameData.status === "playing").slice(0, 12);
  const recent = [...entries]
    .filter((e) => e.userGameData.endedAt)
    .sort((a, b) => (b.userGameData.endedAt ?? "").localeCompare(a.userGameData.endedAt ?? ""))
    .slice(0, 12);

  return (
    <>
      <ProfileStats entries={entries} />

      <Section
        title="Badges"
        icon={AwardIcon}
        count={`${badges.filter((b) => b.earned).length} / ${badges.length}`}
        className="mt-8"
      >
        <Badges badges={badges} />
      </Section>

      {playing.length > 0 && (
        <Section title="Now playing" icon={Gamepad2Icon} count={playing.length} className="mt-8">
          <GameRail>
            {playing.map((g) => (
              <GameCard key={g.id} game={g} rating={g.userGameData.rating} />
            ))}
          </GameRail>
        </Section>
      )}

      {recent.length > 0 && (
        <Section
          title="Recently played"
          icon={Gamepad2Icon}
          action={
            <Link
              to="/$username/journal"
              params={{ username }}
              search={{ year: undefined }}
              className="text-sm text-dimmed hover:text-white"
            >
              Journal
            </Link>
          }
          className="mt-8"
        >
          <GameRail>
            {recent.map((g) => (
              <GameCard key={g.id} game={g} rating={g.userGameData.rating} />
            ))}
          </GameRail>
        </Section>
      )}

      {reviews.data && reviews.data.results.length > 0 && (
        <Section
          title="Recently reviewed"
          icon={MessageSquareTextIcon}
          action={
            <Link
              to="/$username/reviews"
              params={{ username }}
              className="text-sm text-dimmed hover:text-white"
            >
              All reviews
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

      {entries.length === 0 && (
        <div className="panel mt-8 p-12 text-center text-dimmed">Nothing in the list yet.</div>
      )}
    </>
  );
}
