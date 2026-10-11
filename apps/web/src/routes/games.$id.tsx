import { useGetApiGamesById, useGetApiGamesByIdReviews, type Game } from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CameraIcon,
  ClockIcon,
  ExternalLinkIcon,
  LayersIcon,
  MessageSquareTextIcon,
  PlayIcon,
  SparklesIcon,
  StarIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import { useState } from "react";

import { CommunityStats } from "@/components/game/community-stats";
import { GameCard, GameRail } from "@/components/game/game-card";
import { GameCover } from "@/components/game/game-cover";
import { GameLikeButton } from "@/components/game/like-button";
import { LogGameButton } from "@/components/game/log-game-button";
import { ManageListsButton } from "@/components/game/manage-lists-dialog";
import { RatingValue, StatusPill } from "@/components/game/rating";
import { Markdown } from "@/components/markdown";
import { Section } from "@/components/section";
import { ReviewCard } from "@/components/social/review-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/hooks/auth";
import { useMyLibrary } from "@/hooks/library";
import {
  compactNumber,
  formatHours,
  gameTypeName,
  ratingColor,
  releaseDate,
  shortDate,
} from "@/lib/format";
import { igdbImage, youtubeThumbnail } from "@/lib/image";

export const Route = createFileRoute("/games/$id")({
  component: GamePage,
});

function GamePage() {
  const { id } = Route.useParams();
  const gameId = Number(id);
  const {
    data: game,
    isPending,
    error,
  } = useGetApiGamesById(gameId, {
    query: { enabled: Number.isInteger(gameId) && gameId > 0 },
  });

  if (!Number.isInteger(gameId) || gameId <= 0 || error) {
    return (
      <div className="panel mt-10 p-16 text-center text-dimmed">
        This game isn't in the catalog.
        <div className="mt-4">
          <Link to="/" className="font-semibold text-white hover:underline">
            Back home
          </Link>
        </div>
      </div>
    );
  }
  if (isPending) return <GameSkeleton />;
  return <GameDetail game={game} />;
}

function GameSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="aspect-[21/9] w-full rounded-card" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

const DetailRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex gap-2 text-sm">
    <dt className="shrink-0 text-dimmed">{label}:</dt>
    <dd className="min-w-0">{children}</dd>
  </div>
);

function GameDetail({ game }: { game: Game }) {
  const { user } = useSession();
  const { byGameId } = useMyLibrary();
  const entry = byGameId.get(game.id)?.userGameData ?? null;

  const hero = igdbImage(game.screenshots?.[0]?.url, "1080p");
  const typeName = gameTypeName(game.gameType, game.types[0]?.type);
  const date = releaseDate(game.firstReleaseDate, game.firstReleaseDatePrecision);
  const igdbRating = game.totalRating ? game.totalRating / 10 : null;
  const stores = (game.externalGames ?? []).filter((e) => e.url);
  const links = (game.websites ?? []).filter((w) => w.url);
  const related = [...(game.children ?? []), ...(game.editions ?? [])];
  const community = game.community!;
  const [reviewSort, setReviewSort] = useState<"latest" | "top">("latest");
  const reviews = useGetApiGamesByIdReviews(game.id, { sort: reviewSort, limit: 20 });

  return (
    <>
      <div className="relative -mx-4 overflow-hidden sm:-mx-6 sm:rounded-card">
        <div className="relative aspect-[16/7] min-h-64 w-full bg-muted">
          {hero && (
            <img
              src={hero}
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="eager"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="relative z-10 -mt-20 grid gap-4 px-4 sm:-mt-24 sm:px-6 md:grid-cols-[1fr_minmax(0,320px)]">
          <div className="panel flex gap-4 bg-background/80 p-4 backdrop-blur-md sm:gap-5 sm:p-5">
            <GameCover
              url={game.cover?.url}
              name={game.name}
              className="w-24 shrink-0 shadow-2xl sm:w-32"
              loading="eager"
            />
            <dl className="grid flex-1 grid-cols-2 gap-4 self-end sm:grid-cols-3">
              <Stat label="IGDB">
                {igdbRating ? (
                  <RatingValue value={igdbRating} className="text-2xl" />
                ) : (
                  <span className="text-2xl font-bold text-dimmed">–</span>
                )}
                <span className="flex items-center gap-1 text-xs text-dimmed">
                  <StarIcon className="size-3" /> {compactNumber(game.totalRatingCount ?? 0)}
                </span>
              </Stat>
              {game.timeToBeat?.normally ? (
                <Stat label="To finish">
                  <span className="text-2xl font-bold">
                    {formatHours(game.timeToBeat.normally)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-dimmed">
                    <ClockIcon className="size-3" /> {game.timeToBeat.count ?? 0} reports
                  </span>
                </Stat>
              ) : null}
              <Stat label="Members">
                <span
                  className={cn(
                    "text-2xl font-bold",
                    community.ratingAverage ? ratingColor(community.ratingAverage) : "",
                  )}
                >
                  {community.ratingAverage?.toFixed(1) ?? community.total}
                </span>
                <span className="flex items-center gap-1 text-xs text-dimmed">
                  <UsersIcon className="size-3" /> {community.total} in lists
                </span>
              </Stat>
            </dl>
          </div>

          <div className="panel flex flex-col gap-3 bg-background/80 p-4 backdrop-blur-md sm:p-5">
            <div className="flex items-center gap-4">
              <UserAvatar
                user={user ?? { username: "?" }}
                className="size-12"
                textClassName="text-lg"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 text-xs text-dimmed">
                  {entry ? "In your list" : "Your rating"}
                </div>
                <LogGameButton game={game} entry={entry} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <GameLikeButton
                gameId={game.id}
                liked={game.viewer?.liked ?? false}
                count={community.likes}
              />
              <ManageListsButton gameId={game.id} gameName={game.name} />
              {community.lists > 0 && (
                <span className="text-xs text-dimmed">
                  in {community.lists} public {community.lists === 1 ? "list" : "lists"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{game.name}</h1>
        {typeName && <Badge variant="secondary">{typeName}</Badge>}
        {game.deleted && <Badge variant="destructive">Removed from IGDB</Badge>}
      </div>
      {date && <div className="mt-1 text-dimmed">{date}</div>}
      {entry && (
        <div className="mt-3 flex items-center gap-2">
          <StatusPill status={entry.status} size="md" />
          {entry.endedAt && <span className="text-sm text-dimmed">{shortDate(entry.endedAt)}</span>}
        </div>
      )}

      {game.summary && (
        <p className="mt-6 max-w-3xl whitespace-pre-line leading-relaxed text-white/90">
          {game.summary}
        </p>
      )}
      {game.storyline && (
        <div className="mt-5 max-w-3xl">
          <h2 className="mb-1 font-bold">Story</h2>
          <p className="whitespace-pre-line leading-relaxed text-white/80">{game.storyline}</p>
        </div>
      )}
      {entry?.review && (
        <div className="panel mt-6 max-w-3xl p-5">
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="font-semibold">Your review</span>
            <RatingValue value={entry.rating} />
            {entry.spoilers && <span className="text-xs text-dimmed">marked as spoilers</span>}
          </div>
          <Markdown>{entry.review}</Markdown>
        </div>
      )}

      <CommunityStats community={community} mine={entry?.rating} className="mt-6 max-w-3xl" />

      <dl className="mt-8 grid gap-x-8 gap-y-2 md:grid-cols-2">
        {game.developers?.length ? (
          <DetailRow label="Developers">{game.developers.map((c) => c.name).join(", ")}</DetailRow>
        ) : null}
        {game.publishers?.length ? (
          <DetailRow label="Publishers">{game.publishers.map((c) => c.name).join(", ")}</DetailRow>
        ) : null}
        {game.genres.length > 0 && (
          <DetailRow label="Genres">{game.genres.map((g) => g.name).join(" · ")}</DetailRow>
        )}
        {game.platforms.length > 0 && (
          <DetailRow label="Platforms">{game.platforms.map((p) => p.name).join(" · ")}</DetailRow>
        )}
        {game.themes?.length ? (
          <DetailRow label="Themes">{game.themes.map((t) => t.name).join(" · ")}</DetailRow>
        ) : null}
        {game.gameModes?.length ? (
          <DetailRow label="Modes">{game.gameModes.map((m) => m.name).join(" · ")}</DetailRow>
        ) : null}
        {game.collections?.length ? (
          <DetailRow label="Series">{game.collections.map((c) => c.name).join(" · ")}</DetailRow>
        ) : null}
        {game.alternativeNames.length > 0 && (
          <DetailRow label="Also known as">{game.alternativeNames.join(" · ")}</DetailRow>
        )}
        {game.timeToBeat && (game.timeToBeat.hastily || game.timeToBeat.completely) ? (
          <DetailRow label="Time to beat">
            {[
              game.timeToBeat.hastily && `${formatHours(game.timeToBeat.hastily)} rushed`,
              game.timeToBeat.normally && `${formatHours(game.timeToBeat.normally)} normal`,
              game.timeToBeat.completely &&
                `${formatHours(game.timeToBeat.completely)} completionist`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </DetailRow>
        ) : null}
      </dl>

      {(links.length > 0 || stores.length > 0) && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wider text-dimmed uppercase">Links</span>
          {links.map((w) => (
            <LinkChip key={`w${w.id}`} href={w.url} label={w.type ?? "Website"} />
          ))}
          {stores.map((s) => (
            <LinkChip key={`s${s.id}`} href={s.url!} label={s.source ?? s.name ?? "Store"} />
          ))}
        </div>
      )}

      {game.screenshots && game.screenshots.length > 0 && (
        <Section title="Screenshots" icon={CameraIcon} count={game.screenshots.length}>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
            {game.screenshots.map((shot) => (
              <a
                key={shot.id}
                href={igdbImage(shot.url, "1080p") ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="w-[85%] shrink-0 snap-start overflow-hidden rounded-lg bg-muted sm:w-[70%] md:w-[60%]"
              >
                <img
                  src={igdbImage(shot.url, "screenshot_big") ?? undefined}
                  alt=""
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </Section>
      )}

      {game.videos && game.videos.length > 0 && (
        <Section title="Videos" icon={PlayIcon} count={game.videos.length}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {game.videos.map((video) => (
              <a
                key={video.id}
                href={video.url}
                target="_blank"
                rel="noreferrer"
                className="group relative overflow-hidden rounded-lg bg-muted"
                title={video.name ?? undefined}
              >
                <img
                  src={youtubeThumbnail(video.videoId)}
                  alt=""
                  className="aspect-video w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                  loading="lazy"
                />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-black/60 ring-1 ring-white/70">
                    <PlayIcon className="ml-0.5 size-4 fill-white text-white" />
                  </span>
                </span>
                {video.name && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent p-2 text-xs">
                    {video.name}
                  </span>
                )}
              </a>
            ))}
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section title="Editions and add-ons" icon={LayersIcon} count={related.length}>
          <GameRail>
            {related.map((r) => (
              <div key={r.id}>
                <GameCard game={r} rating={byGameId.get(r.id)?.userGameData.rating} />
                <div className="mt-2 line-clamp-2 text-xs font-semibold">{r.name}</div>
                <div className="text-xs text-dimmed">
                  {[gameTypeName(r.gameType), releaseDate(r.firstReleaseDate, "year")]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            ))}
          </GameRail>
        </Section>
      )}

      {game.similarGames && game.similarGames.length > 0 && (
        <Section title="Similar games" icon={SparklesIcon} count={game.similarGames.length}>
          <GameRail>
            {game.similarGames.map((g) => (
              <div key={g.id}>
                <GameCard game={g} rating={byGameId.get(g.id)?.userGameData.rating} />
                <div className="mt-2 line-clamp-2 text-xs font-semibold">{g.name}</div>
              </div>
            ))}
          </GameRail>
        </Section>
      )}

      <Section
        title="Reviews"
        icon={MessageSquareTextIcon}
        count={community.reviews}
        action={
          <div className="flex gap-1 text-sm">
            {(["latest", "top"] as const).map((sort) => (
              <button
                key={sort}
                type="button"
                onClick={() => setReviewSort(sort)}
                className={cn(
                  "rounded-full px-3 py-1 font-semibold capitalize",
                  reviewSort === sort ? "bg-white/10 text-white" : "text-dimmed hover:text-white",
                )}
              >
                {sort === "top" ? "Most reacted" : "Latest"}
              </button>
            ))}
          </div>
        }
      >
        {reviews.isPending && <Skeleton className="h-32 rounded-card" />}
        {reviews.data?.results.length === 0 && (
          <div className="panel p-10 text-center text-sm text-dimmed">
            No reviews yet.{" "}
            {entry
              ? "Edit your entry to write one."
              : "Add the game to your list and write the first."}
          </div>
        )}
        <div className="space-y-3">
          {reviews.data?.results.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      </Section>

      {game.localizedCovers && game.localizedCovers.length > 0 && (
        <Section title="Regional covers" icon={UsersIcon} count={game.localizedCovers.length}>
          <GameRail>
            {game.localizedCovers.map((c) => (
              <div key={c.id}>
                <GameCover url={c.url} name={c.name ?? game.name} />
                {c.name && <div className="mt-2 line-clamp-2 text-xs text-dimmed">{c.name}</div>}
              </div>
            ))}
          </GameRail>
        </Section>
      )}
    </>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-dimmed">{label}</dt>
      <dd className="flex flex-col leading-tight">{children}</dd>
    </div>
  );
}

function LinkChip({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium transition-colors hover:bg-white/10",
        className,
      )}
    >
      {label} <ExternalLinkIcon className="size-3 text-dimmed" />
    </a>
  );
}
