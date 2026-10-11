import {
  StatusEnum,
  GetApiUsersSort,
  GetApiGamesSort,
  useGetApiGames,
  useGetApiMeFeed,
  useGetApiReviews,
  type Game,
} from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "@/i18n/date";
import {
  ActivityIcon,
  CalendarIcon,
  FlameIcon,
  Gamepad2Icon,
  LibraryIcon,
  MessageSquareTextIcon,
  TrophyIcon,
} from "lucide-react";
import { Trans, useTranslation } from "react-i18next";

import { GameCard, GameRail } from "@/components/game/game-card";
import { GameCover } from "@/components/game/game-cover";
import { RatingValue, StatusPill } from "@/components/game/rating";
import { Section } from "@/components/section";
import { ReviewCard } from "@/components/social/review-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { Verdict } from "@/components/home/verdict";
import { useSession } from "@/hooks/auth";
import { useMyLibrary } from "@/hooks/library";
import { relativeDate } from "@/lib/format";
import { DateFormat, IgdbSize } from "@/lib/enums";
import { ChartTab } from "@/lib/enums";

export const Route = createFileRoute("/")({
  component: Home,
});

const RAIL = 20;

function Home() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { byGameId, entries, isLoading: libraryLoading } = useMyLibrary();
  const popular = useGetApiGames({ sort: GetApiGamesSort.Popular, limit: RAIL });
  const recent = useGetApiGames({ sort: GetApiGamesSort.Recent, limit: RAIL });
  const now = Math.floor(Date.now() / 1000);
  const week = useGetApiGames({
    sort: GetApiGamesSort.Date,
    releasedFrom: now - 86_400,
    releasedTo: now + 7 * 86_400,
    limit: RAIL,
  });
  const freshReviews = useGetApiReviews({ limit: 6 });
  const feed = useGetApiMeFeed({ limit: 12 }, { query: { enabled: !!user } });

  const playing = entries
    .filter((e) => e.userGameData.status === StatusEnum.Playing)
    .slice(0, RAIL);
  const latest = entries.slice(0, RAIL);

  return (
    <>
      {user && user.username && !libraryLoading ? (
        <Verdict username={user.username} entries={entries} />
      ) : (
        <section className="grid border-b border-border py-12 md:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="eyebrow">{t("home.guest.eyebrow")}</div>
            <h1 className="mt-4 text-4xl leading-[.95] sm:text-5xl lg:text-6xl">
              {t("home.guest.title")}
            </h1>
            <p className="mt-5 max-w-[44ch] text-lg text-dimmed">{t("home.guest.text")}</p>
            <div className="mt-7 flex flex-wrap gap-2">
              <Button asChild variant="destructive">
                <Link to="/auth">{t("home.guest.start")}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/search" search={{ q: "", page: 1, editions: false }}>
                  <Gamepad2Icon /> {t("home.guest.browse")}
                </Link>
              </Button>
            </div>
          </div>
          <div className="eyebrow mt-8 self-end md:mt-0 md:text-right">{t("home.guest.fine")}</div>
        </section>
      )}

      {playing.length > 0 && (
        <Section title={t("home.sections.nowPlaying")} icon={Gamepad2Icon} count={playing.length}>
          <GameRail>
            {playing.map((g) => (
              <GameCard key={g.id} game={g} rating={g.userGameData.rating} />
            ))}
          </GameRail>
        </Section>
      )}

      {feed.data && feed.data.results.length > 0 && (
        <Section
          title={t("home.sections.friends")}
          icon={ActivityIcon}
          action={
            <Link
              to="/community"
              search={{ q: "", sort: GetApiUsersSort.Games, page: 1 }}
              className="text-sm text-dimmed hover:text-white"
            >
              {t("home.sections.community")}
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
                  <Trans
                    i18nKey={item.isNew ? "home.feed.added" : "home.feed.updated"}
                    values={{ name: item.user.name || item.user.username, game: item.game.name }}
                    components={{
                      user: (
                        <Link
                          to="/$username"
                          params={{ username: item.user.username ?? "" }}
                          className="font-semibold hover:underline"
                        />
                      ),
                      game: (
                        <Link
                          to="/games/$id"
                          params={{ id: String(item.game.id) }}
                          className="font-semibold hover:underline"
                        />
                      ),
                    }}
                  />
                  {item.hasReview && (
                    <span className="text-dimmed"> {t("home.feed.reviewed")}</span>
                  )}
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
                    size={IgdbSize.CoverSmall}
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
          title={t("home.sections.thisWeek")}
          icon={CalendarIcon}
          action={
            <Link
              to="/calendar"
              search={{ month: format(new Date(), DateFormat.IsoMonth), hot: false, mine: false }}
              className="text-sm text-dimmed hover:text-white"
            >
              {t("home.sections.openCalendar")}
            </Link>
          }
        >
          <GameRail>
            {week.data.results.map((g) => (
              <div key={g.id}>
                <GameCard game={g} rating={byGameId.get(g.id)?.userGameData.rating} />
                <div className="mt-1.5 text-xs text-dimmed">
                  {g.firstReleaseDate
                    ? format(new Date(g.firstReleaseDate * 1000), DateFormat.MonthDay)
                    : ""}
                </div>
              </div>
            ))}
          </GameRail>
        </Section>
      )}

      <Section
        title={t("home.sections.trending")}
        icon={FlameIcon}
        action={
          <Link
            to="/charts"
            search={{
              tab: ChartTab.Popular,
              genreId: undefined,
              platformId: undefined,
              year: undefined,
              type: undefined,
              page: 1,
            }}
            className="text-sm text-dimmed hover:text-white"
          >
            {t("home.sections.charts")}
          </Link>
        }
      >
        <Rail games={popular.data?.results} byGameId={byGameId} />
      </Section>

      {freshReviews.data && freshReviews.data.results.length > 0 && (
        <Section title={t("home.sections.freshReviews")} icon={MessageSquareTextIcon}>
          <div className="grid gap-3 md:grid-cols-2">
            {freshReviews.data.results.map((review) => (
              <ReviewCard key={review.id} review={review} withGame />
            ))}
          </div>
        </Section>
      )}

      <Section title={t("home.sections.newReleases")} icon={CalendarIcon}>
        <Rail games={recent.data?.results} byGameId={byGameId} />
      </Section>

      {latest.length > 0 && (
        <Section title={t("home.sections.recentlyAdded")} icon={LibraryIcon}>
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
  const { t } = useTranslation();
  if (!games) {
    return (
      <GameRail>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="cover" />
        ))}
      </GameRail>
    );
  }
  if (games.length === 0) return <p className="text-sm text-dimmed">{t("home.catalogFilling")}</p>;
  return (
    <GameRail>
      {games.map((g) => (
        <GameCard key={g.id} game={g} rating={byGameId.get(g.id)?.userGameData.rating} />
      ))}
    </GameRail>
  );
}
