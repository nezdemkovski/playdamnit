import {
  useGetApiUserByUsernameFollowers,
  useGetApiUserByUsernameFollowing,
} from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "cn";
import { useTranslation } from "react-i18next";

import { FollowButton } from "@/components/social/follow-button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useProfileContext } from "@/hooks/profile";
import { FriendsTab } from "@/lib/enums";

export const Route = createFileRoute("/$username/friends")({
  validateSearch: (raw: Record<string, unknown>) => ({
    tab: raw.tab === FriendsTab.Following ? FriendsTab.Following : FriendsTab.Followers,
  }),
  component: ProfileFriends,
});

function ProfileFriends() {
  const { t } = useTranslation();
  const { username } = useProfileContext();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const followers = useGetApiUserByUsernameFollowers(
    username,
    { limit: 100 },
    { query: { enabled: tab === FriendsTab.Followers } },
  );
  const following = useGetApiUserByUsernameFollowing(
    username,
    { limit: 100 },
    { query: { enabled: tab === FriendsTab.Following } },
  );
  const query = tab === FriendsTab.Followers ? followers : following;

  return (
    <>
      <div className="flex gap-1">
        {Object.values(FriendsTab).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => navigate({ search: { tab: name } })}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold",
              tab === name ? "bg-primary text-primary-foreground" : "text-dimmed hover:text-white",
            )}
          >
            {t(`profile.friends.${name}`)}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {query.isPending && <Skeleton className="h-16 rounded-card" />}
        {query.data?.results.length === 0 && (
          <div className="panel p-12 text-center text-dimmed">{t("profile.friends.empty")}</div>
        )}
        {query.data?.results.map((member) => (
          <div key={member.id} className="panel flex items-center gap-3 p-3">
            <Link to="/$username" params={{ username: member.username ?? "" }}>
              <UserAvatar user={member} className="size-10" />
            </Link>
            <div className="min-w-0 flex-1">
              {/* Long names and handles cut to one line */}
              <div className="flex min-w-0 items-baseline gap-2">
                <Link
                  to="/$username"
                  params={{ username: member.username ?? "" }}
                  className="min-w-0 truncate font-bold hover:underline"
                >
                  {member.name || member.username}
                </Link>
                <span className="min-w-0 shrink-[3] truncate text-xs text-dimmed">
                  @{member.username}
                </span>
              </div>
            </div>
            <FollowButton
              username={member.username ?? ""}
              isFollowing={member.isFollowing}
              size="xs"
            />
          </div>
        ))}
      </div>
    </>
  );
}
