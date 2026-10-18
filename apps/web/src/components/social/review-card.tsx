import { ContentActions } from "./content-actions";
import { ContentKind } from "@playdamnit/api-client";
import { PutApiReviewsByIdReactionBodyEmoji, type Review } from "@playdamnit/api-client";
import { Link, useNavigate } from "@tanstack/react-router";
import { EyeOffIcon, SmilePlusIcon, TrophyIcon } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { GameCover } from "@/components/game/game-cover";
import { GradeBadge, StatusPill } from "@/components/game/rating";
import { PillSize } from "@/lib/enums";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/hooks/auth";
import { useReviewReaction } from "@/hooks/social";

const EMOJIS = Object.values(PutApiReviewsByIdReactionBodyEmoji);
type Emoji = (typeof EMOJIS)[number];
import { relativeDate, releaseYear, shortDate } from "@/lib/format";

interface ReviewCardProps {
  review: Review;
  /** Show the game (feeds and profiles); game pages leave it out */
  withGame?: boolean;
  className?: string;
}

export function ReviewCard({ review, withGame, className }: ReviewCardProps) {
  const { t } = useTranslation();
  const { user } = useSession();
  const navigate = useNavigate();
  const { toggle, isPending } = useReviewReaction();
  const [revealed, setRevealed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const hidden = review.spoilers && !revealed;
  const username = review.user.username ?? "";

  const react = (emoji: Emoji) => {
    setPickerOpen(false);
    if (!user) return navigate({ to: "/auth" });
    toggle(review.id, review.gameId, emoji, review.myReaction);
  };

  if (blocked) return null;
  return (
    <article className={cn("panel p-4 sm:p-5", className)}>
      <div className="flex gap-4">
        {withGame && review.game && (
          <Link
            to="/games/$id"
            params={{ id: String(review.gameId) }}
            className="relative w-16 shrink-0 sm:w-20"
          >
            <GameCover url={review.game.cover?.url} name={review.game.name} />
            <GradeBadge grade={review.grade} onArt className="absolute -top-2.5 -right-2.5 block" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <ContentActions
              kind={ContentKind.Review}
              targetId={review.id}
              authorId={review.user.id}
              didBlock={() => setBlocked(true)}
            />
            <Link to="/$username" params={{ username }} className="shrink-0">
              <UserAvatar user={review.user} className="size-10" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-baseline gap-x-2">
                <Link
                  to="/$username"
                  params={{ username }}
                  className="min-w-0 truncate font-bold hover:underline"
                >
                  {review.user.name || username}
                </Link>
                <span className="hidden min-w-0 shrink-[3] truncate text-xs text-dimmed sm:block">
                  @{username}
                </span>
              </div>
              {withGame && review.game && (
                <Link
                  to="/games/$id"
                  params={{ id: String(review.gameId) }}
                  className="block truncate text-sm text-white/80 hover:underline"
                >
                  {review.game.name}
                  {releaseYear(review.game.firstReleaseDate) && (
                    <span className="text-dimmed">
                      {" "}
                      {releaseYear(review.game.firstReleaseDate)}
                    </span>
                  )}
                </Link>
              )}
            </div>
            <div
              className="text-right text-xs text-dimmed"
              title={shortDate(review.updatedAt) ?? undefined}
            >
              {relativeDate(review.updatedAt)}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!(withGame && review.game) && <GradeBadge grade={review.grade} size={PillSize.Md} />}
            <StatusPill status={review.status} />
            {review.mastered && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-semibold text-warning">
                <TrophyIcon className="size-3" /> {t("review.mastered")}
              </span>
            )}
            {review.endedAt && (
              <span className="text-xs text-dimmed">{shortDate(review.endedAt)}</span>
            )}
          </div>

          <div className="mt-3 text-[15px]">
            {hidden ? (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 py-4 text-sm text-dimmed hover:bg-white/5 hover:text-white"
              >
                <EyeOffIcon className="size-4" /> {t("review.spoiler")}
              </button>
            ) : (
              <Markdown>{review.review}</Markdown>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {review.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                disabled={isPending || !review.allowReactions}
                onClick={() => react(r.emoji as Emoji)}
                aria-pressed={review.myReaction === r.emoji}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors",
                  review.myReaction === r.emoji
                    ? "border-status-want_to_play/60 bg-status-want_to_play/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/10",
                )}
              >
                <span>{r.emoji}</span>
                <span className="text-xs font-semibold tabular-nums text-dimmed">{r.count}</span>
              </button>
            ))}
            {review.allowReactions ? (
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("review.addReaction")}
                    className="rounded-full text-dimmed"
                  >
                    <SmilePlusIcon />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="start"
                  className="w-auto rounded-full border-white/10 bg-popover p-1.5"
                >
                  <div className="flex gap-0.5">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => react(emoji)}
                        aria-label={emoji}
                        className={cn(
                          "size-8 rounded-full text-lg leading-none transition-transform hover:scale-125 hover:bg-white/10",
                          review.myReaction === emoji && "bg-white/15",
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              review.reactions.length === 0 && (
                <span className="text-xs text-dimmed">{t("review.reactionsOff")}</span>
              )
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
