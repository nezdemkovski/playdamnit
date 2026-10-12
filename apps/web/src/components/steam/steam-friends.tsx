import { useGetApiMeSteamFriends } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { FollowButton } from "@/components/social/follow-button";
import { UserAvatar } from "@/components/user-avatar";
import { SteamLogo } from "./steam-logo";

/** The viewer's Steam friends who are here, to follow; renders nothing when there are none */
export function SteamFriends({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const query = useGetApiMeSteamFriends({ query: { enabled } });
  const users = query.data?.users ?? [];
  if (users.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
        <SteamLogo className="size-4" /> {t("steam.friends")}
        <span className="num text-sm text-dimmed">{users.length}</span>
      </h2>
      <div className="space-y-2">
        {users.map((friend) => (
          <div key={friend.id} className="panel flex items-center gap-4 p-3 sm:p-4">
            <Link to="/$username" params={{ username: friend.username ?? "" }}>
              <UserAvatar user={friend} className="size-12" />
            </Link>
            <div className="min-w-0 flex-1">
              {/* Long names and handles cut to one line */}
              <div className="flex min-w-0 items-baseline gap-2">
                <Link
                  to="/$username"
                  params={{ username: friend.username ?? "" }}
                  className="min-w-0 truncate font-bold hover:underline"
                >
                  {friend.name || friend.username}
                </Link>
                <span className="min-w-0 shrink-[3] truncate text-xs text-dimmed">
                  @{friend.username}
                </span>
              </div>
              {friend.steamName && (
                <div className="flex items-center gap-1.5 text-xs text-dimmed">
                  <SteamLogo className="size-3" /> {friend.steamName}
                </div>
              )}
            </div>
            <FollowButton username={friend.username ?? ""} isFollowing={friend.isFollowing} />
          </div>
        ))}
      </div>
    </section>
  );
}
