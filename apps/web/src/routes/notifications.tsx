import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { BellIcon, HeartIcon, UserPlusIcon } from "lucide-react";
import { cn } from "cn";
import { useEffect } from "react";

import { GameCover } from "@/components/game/game-cover";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/hooks/auth";
import { useNotifications } from "@/hooks/social";
import { relativeDate } from "@/lib/format";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, isLoading } = useSession();
  const navigate = useNavigate();
  const notifications = useNotifications(!!user);

  useEffect(() => {
    if (!isLoading && !user) navigate({ to: "/auth", replace: true });
  }, [isLoading, user, navigate]);

  // Opening the page reads everything
  useEffect(() => {
    if (notifications.data && notifications.data.unread > 0) notifications.markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.data?.unread]);

  return (
    <>
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <BellIcon className="size-6 text-dimmed" /> Notifications
      </h1>
      <div className="mt-6 space-y-2">
        {notifications.isPending &&
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 rounded-card" />)}
        {notifications.data?.results.length === 0 && (
          <div className="panel p-12 text-center text-dimmed">
            Nothing yet. Follows and likes on your reviews show up here.
          </div>
        )}
        {notifications.data?.results.map((n) => {
          const username = n.actor.username ?? "";
          return (
            <div
              key={n.id}
              className={cn(
                "panel flex items-center gap-3 p-3 sm:p-4",
                !n.readAt && "border-white/15 bg-white/[0.05]",
              )}
            >
              <Link to="/$username" params={{ username }}>
                <UserAvatar user={n.actor} className="size-10" />
              </Link>
              <div className="min-w-0 flex-1 text-sm">
                <Link to="/$username" params={{ username }} className="font-bold hover:underline">
                  {n.actor.name || username}
                </Link>{" "}
                {n.type === "follow" ? (
                  <span className="text-white/80">started following you</span>
                ) : (
                  <span className="text-white/80">
                    liked your review of{" "}
                    {n.game ? (
                      <Link
                        to="/games/$id"
                        params={{ id: String(n.game.id) }}
                        className="font-semibold hover:underline"
                      >
                        {n.game.name}
                      </Link>
                    ) : (
                      "a game"
                    )}
                  </span>
                )}
                <div className="text-xs text-dimmed">{relativeDate(n.createdAt)}</div>
              </div>
              {n.type === "follow" ? (
                <UserPlusIcon className="size-5 text-status-want_to_play" />
              ) : n.game ? (
                <Link to="/games/$id" params={{ id: String(n.game.id) }} className="w-9 shrink-0">
                  <GameCover
                    url={n.game.cover.url}
                    name={n.game.name}
                    size="cover_small"
                    className="rounded-md"
                  />
                </Link>
              ) : (
                <HeartIcon className="size-5 text-destructive" />
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
