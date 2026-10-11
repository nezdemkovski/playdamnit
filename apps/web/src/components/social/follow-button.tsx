import { useNavigate } from "@tanstack/react-router";
import { UserMinusIcon, UserPlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/auth";
import { useFollow } from "@/hooks/social";

interface FollowButtonProps {
  username: string;
  isFollowing: boolean;
  size?: "xs" | "sm" | "default";
}

export function FollowButton({ username, isFollowing, size = "sm" }: FollowButtonProps) {
  const { t } = useTranslation();
  const { user } = useSession();
  const navigate = useNavigate();
  const { follow, unfollow, isPending } = useFollow(username);
  if (user?.username === username) return null;

  const onClick = () => {
    if (!user) return navigate({ to: "/auth" });
    return isFollowing ? unfollow() : follow();
  };

  return (
    <Button
      variant={isFollowing ? "secondary" : "default"}
      size={size}
      onClick={onClick}
      disabled={isPending}
    >
      {isFollowing ? <UserMinusIcon /> : <UserPlusIcon />}
      {isFollowing ? t("follow.following") : t("follow.follow")}
    </Button>
  );
}
