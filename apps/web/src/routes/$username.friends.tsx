import {
  useGetApiUserByUsernameFollowers,
  useGetApiUserByUsernameFollowing,
} from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "cn";

import { FollowButton } from "@/components/social/follow-button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useProfileContext } from "@/hooks/profile";

export const Route = createFileRoute("/$username/friends")({
  validateSearch: (raw: Record<string, unknown>) => ({
    tab: (raw.tab === "following" ? "following" : "followers") as "followers" | "following",
  }),
  component: ProfileFriends,
});

function ProfileFriends() {
  const { username } = useProfileContext();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const followers = useGetApiUserByUsernameFollowers(
    username,
    { limit: 100 },
    { query: { enabled: tab === "followers" } },
  );
  const following = useGetApiUserByUsernameFollowing(
    username,
    { limit: 100 },
    { query: { enabled: tab === "following" } },
  );
  const query = tab === "followers" ? followers : following;

  return (
    <>
      <div className="flex gap-1">
        {(["followers", "following"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => navigate({ search: { tab: t } })}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold capitalize",
              tab === t ? "bg-primary text-primary-foreground" : "text-dimmed hover:text-white",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {query.isPending && <Skeleton className="h-16 rounded-card" />}
        {query.data?.results.length === 0 && (
          <div className="panel p-12 text-center text-dimmed">Nobody here yet.</div>
        )}
        {query.data?.results.map((member) => (
          <div key={member.id} className="panel flex items-center gap-3 p-3">
            <Link to="/$username" params={{ username: member.username ?? "" }}>
              <UserAvatar user={member} className="size-10" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                to="/$username"
                params={{ username: member.username ?? "" }}
                className="font-bold hover:underline"
              >
                {member.name || member.username}
              </Link>
              <span className="ml-2 text-xs text-dimmed">@{member.username}</span>
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
