import { useGetApiUserByUsername } from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";

import { LibraryList } from "@/components/profile/library-list";
import { ProfileHeader } from "@/components/profile/profile-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/auth";
import { useLibrary } from "@/hooks/library";

export const Route = createFileRoute("/$username/")({
  component: ProfilePage,
});

function ProfilePage() {
  const { username } = Route.useParams();
  const { user: viewer } = useSession();
  const profile = useGetApiUserByUsername(username);
  const library = useLibrary(username);
  const isOwn = !!viewer?.username && viewer.username.toLowerCase() === username.toLowerCase();

  if (profile.error) {
    return (
      <div className="panel mt-10 p-16 text-center text-dimmed">
        No user called <span className="font-semibold text-white">@{username}</span>.
        <div className="mt-4">
          <Link to="/" className="font-semibold text-white hover:underline">
            Back home
          </Link>
        </div>
      </div>
    );
  }

  if (profile.isPending || library.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-10 rounded-full" />
        <Skeleton className="h-28 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </div>
    );
  }

  const entries = library.data?.results ?? [];

  return (
    <>
      <ProfileHeader user={profile.data} entries={entries} isOwn={isOwn} />
      <LibraryList entries={entries} editable={isOwn} />
    </>
  );
}
