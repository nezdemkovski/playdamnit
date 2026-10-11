import { useNavigate } from "@tanstack/react-router";
import { HeartIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/auth";
import { useGameLike } from "@/hooks/social";

export function GameLikeButton({
  gameId,
  liked,
  count,
}: {
  gameId: number;
  liked: boolean;
  count: number;
}) {
  const { user } = useSession();
  const navigate = useNavigate();
  const { toggle, isPending } = useGameLike(gameId);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={isPending}
      aria-pressed={liked}
      onClick={() => (user ? toggle(liked) : navigate({ to: "/auth" }))}
      className={cn(liked && "text-destructive")}
    >
      <HeartIcon className={cn(liked && "fill-current")} /> {count}
    </Button>
  );
}
