import {
  useGetApiGames,
  useGetApiMeFeed,
  useGetApiReviews,
  type Game,
} from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ActivityIcon,
  CalendarIcon,
  FlameIcon,
  Gamepad2Icon,
  LibraryIcon,
  MessageSquareTextIcon,
  TrophyIcon,
} from "lucide-react";

import { GameCard, GameRail } from "@/components/game/game-card";
import { GameCover } from "@/components/game/game-cover";
import { RatingValue, StatusPill } from "@/components/game/rating";
import { Section } from "@/components/section";
import { ReviewCard } from "@/components/social/review-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/hooks/auth";
import { useMyLibrary } from "@/hooks/library";
import { relativeDate } from "@/lib/format";

export const Route = createFileRoute("/")({
  component: Home,
});

const RAIL = 20;

function Home() {
  const { user } = useSession();
  const { byGameId, entries } = useMyLibrary();
  const popular = useGetApiGames({ sort: "popular", limit: RAIL });
  const recent = useGetApiGames({ sort: "recent", limit: RAIL });
  const now = Math.floor(Date.now() / 1000);
  const week = useGetApiGames({
    sort: "date",
    releasedFrom: now - 86_400,
    releasedTo: now + 7 * 86_400,
    limit: RAIL,
  });
  const freshReviews = useGetApiReviews({ limit: 6 });
  const feed = useGetApiMeFeed({ limit: 12 }, { query: { enabled: !!user } });

  const playing = entries.filter((e) => e.userGameData.status === "playing").slice(0, RAIL);
  const latest = entries.slice(0, RAIL);

  return (
    <>
      <section className="panel relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-status-finished/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-status-playing/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <img src="/logo.svg" alt="" className="h-20 w-auto shrink-0 rounded-xl sm:h-28" />
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              {user ? `Welcome back, ${user.username ?? user.name}` : "Play, damn it."}
            </h1>
            <p className="mt-2 max-w-xl text-dimmed">
              Track every game you play, rate it, write a few words and keep the backlog honest. The
              whole IGDB catalog, no account needed to browse.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {user ? (
                <Button asChild size="lg">
                  <Link to="/$username" params={{ username: user.username ?? "" }}>
                    <LibraryIcon /> My list
                  </Link>
                </Button>
              ) : (
                <Button asChild size="lg">
                  <Link to="/auth">Create your list</Link>
                </Button>
              )}
              <Button asChild variant="outline" size="lg">
                <Link to="/search" search={{ q: "", page: 1, editions: false }}>
                  <Gamepad2Icon /> Browse games
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {playing.length > 0 && (
        <Section title="Now playing" icon={Gamepad2Icon} count={playing.length}>
          <GameRail>
            {playing.map((g) => (
              <GameCard key={g.id} game={g} rating={g.userGameData.rating} />
            ))}
          </GameRail>
        </Section>
      )}

      {feed.data && feed.data.results.length > 0 && (
        <Section
          title="Friends activity"
          icon={ActivityIcon}
          action={
            <Link
              to="/community"
              search={{ q: "", sort: "games", page: 1 }}
              className="text-sm text-dimmed hover:text-white"
            >
              Community
            </Link>
          }
        >
          <div className="panel divide-y divide-white/5">
            {feed.data.results.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link to="/$username" params={{ username: item.user.username ?? "" }}>
                  <UserAvatar user={item.user} className="size-8" textClassName="text-xs" />
                </Link>
                <div className="min-w-0 flex-1 truncate">
                  <Link
                    to="/$username"
                    params={{ username: item.user.username ?? "" }}
                    className="font-semibold hover:underline"
                  >
                    {item.user.name || item.user.username}
                  </Link>
                  <span className="text-dimmed"> {item.isNew ? "added" : "updated"} </span>
                  <Link
                    to="/games/$id"
                    params={{ id: String(item.game.id) }}
                    className="font-semibold hover:underline"
                  >
                    {item.game.name}
                  </Link>
                  {item.hasReview && <span className="text-dimmed"> · reviewed</span>}
                </div>
                {item.mastered && <TrophyIcon className="size-4 text-warning" />}
                <RatingValue value={item.rating} />
                <StatusPill status={item.status} />
                <span className="hidden w-20 text-right text-xs text-dimmed sm:block">
                  {relativeDate(item.at)}
                </span>
                <Link
                  to="/games/$id"
                  params={{ id: String(item.game.id) }}
                  className="w-7 shrink-0"
                >
                  <GameCover
                    url={item.game.cover?.url}
                    name={item.game.name}
                    size="cover_small"
                    className="rounded"
                  />
                </Link>
              </div>
            ))}
          </div>
        </Section>
      )}

      {week.data && week.data.results.length > 0 && (
        <Section
          title="This week"
          icon={CalendarIcon}
          action={
            <Link
              to="/calendar"
              search={{ month: format(new Date(), "yyyy-MM"), hot: false, mine: false }}
              className="text-sm text-dimmed hover:text-white"
            >
              Open the calendar
            </Link>
          }
        >
          <GameRail>
            {week.data.results.map((g) => (
              <div key={g.id}>
                <GameCard game={g} rating={byGameId.get(g.id)?.userGameData.rating} />
                <div className="mt-1.5 text-xs text-dimmed">
                  {g.firstReleaseDate ? format(new Date(g.firstReleaseDate * 1000), "MMM d") : ""}
                </div>
              </div>
            ))}
          </GameRail>
        </Section>
      )}

      <Section
        title="Trending"
        icon={FlameIcon}
        action={
          <Link
            to="/charts"
            search={{
              tab: "popular",
              genreId: undefined,
              platformId: undefined,
              year: undefined,
              type: undefined,
              page: 1,
            }}
            className="text-sm text-dimmed hover:text-white"
          >
            Charts
          </Link>
        }
      >
        <Rail games={popular.data?.results} byGameId={byGameId} />
      </Section>

      {freshReviews.data && freshReviews.data.results.length > 0 && (
        <Section title="Fresh reviews" icon={MessageSquareTextIcon}>
          <div className="grid gap-3 md:grid-cols-2">
            {freshReviews.data.results.map((review) => (
              <ReviewCard key={review.id} review={review} withGame />
            ))}
          </div>
        </Section>
      )}

      <Section title="New releases" icon={CalendarIcon}>
        <Rail games={recent.data?.results} byGameId={byGameId} />
      </Section>

      {latest.length > 0 && (
        <Section title="Recently added to your list" icon={LibraryIcon}>
          <GameRail>
            {latest.map((g) => (
              <GameCard key={g.id} game={g} rating={g.userGameData.rating} />
            ))}
          </GameRail>
        </Section>
      )}
    </>
  );
}

function Rail({
  games,
  byGameId,
}: {
  games: Game[] | undefined;
  byGameId: ReturnType<typeof useMyLibrary>["byGameId"];
}) {
  if (!games) {
    return (
      <GameRail>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="cover" />
        ))}
      </GameRail>
    );
  }
  if (games.length === 0)
    return <p className="text-sm text-dimmed">The catalog is still filling up.</p>;
  return (
    <GameRail>
      {games.map((g) => (
        <GameCard key={g.id} game={g} rating={byGameId.get(g.id)?.userGameData.rating} />
      ))}
    </GameRail>
  );
}
