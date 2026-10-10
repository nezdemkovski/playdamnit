import { createFileRoute } from "@tanstack/react-router";

import ProfileClient from "@/components/profile/ProfileClient";
import { useSession } from "@/hooks/auth";

export const Route = createFileRoute("/$username/")({
  component: UserProfilePage,
});

function UserProfilePage() {
  const { username } = Route.useParams();
  const { user: currentUser } = useSession();

  const isOwnProfile =
    currentUser?.username?.toLowerCase() === username.toLowerCase();

  return (
    <ProfileClient
      username={username}
      isOwnProfile={isOwnProfile}
      currentUser={currentUser}
    />
  );
}
