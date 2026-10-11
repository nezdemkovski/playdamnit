import { createFileRoute } from "@tanstack/react-router";

import { LibraryList } from "@/components/profile/library-list";
import { PrivateNotice } from "@/components/profile/private-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileContext } from "@/hooks/profile";

export const Route = createFileRoute("/$username/games")({
  component: ProfileGames,
});

function ProfileGames() {
  const { entries, library, isOwn, isPrivate } = useProfileContext();
  if (isPrivate) return <PrivateNotice />;
  if (library.isPending) return <Skeleton className="h-64 rounded-card" />;
  return <LibraryList entries={entries} editable={isOwn} />;
}
