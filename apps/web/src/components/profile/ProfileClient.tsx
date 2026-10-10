import { AxiosError } from "axios";
import { Loader2 } from "lucide-react";

import { ProfileContent } from "./ProfileContent";
import UserNotFound from "./UserNotFound";
import { useGetApiUserByUsername } from "@playdamnit/api-client";

type ProfileClientProps = {
  username: string;
  isOwnProfile: boolean;
  currentUser: {
    name: string;
    image?: string | null;
    username?: string | null;
  } | null;
};

export default function ProfileClient({ username, isOwnProfile, currentUser }: ProfileClientProps) {
  const {
    data: profileUser,
    isLoading: isUserLoading,
    error: userError,
  } = useGetApiUserByUsername(username);

  if (isUserLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  if (userError && userError instanceof AxiosError && userError.response?.status === 404) {
    return <UserNotFound />;
  }

  return (
    <ProfileContent
      isOwnProfile={isOwnProfile}
      username={username}
      fullName={profileUser?.name || (isOwnProfile ? currentUser?.name : "") || ""}
      avatarUrl={profileUser?.image || (isOwnProfile ? currentUser?.image : "") || ""}
    />
  );
}
