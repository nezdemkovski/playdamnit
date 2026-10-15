import {
  getApiUserByUsernameLikes,
  getGetApiUserByUsernameLikesQueryKey,
} from "@playdamnit/api-client";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LoadMore } from "@/components/load-more";
import { GameCard } from "@/components/game/game-card";
import { PrivateNotice } from "@/components/profile/private-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyLibrary } from "@/hooks/library";
import { usePaged } from "@/hooks/paged";
import { useProfileContext } from "@/hooks/profile";

const PAGE = 60;

export const Route = createFileRoute("/$username/likes")({
  component: ProfileLikes,
});

function ProfileLikes() {
  const { t } = useTranslation();
  const { username, isPrivate } = useProfileContext();
  const { byGameId } = useMyLibrary();
  const likes = usePaged({
    queryKey: getGetApiUserByUsernameLikesQueryKey(username),
    fetchPage: (offset, limit, signal) =>
      getApiUserByUsernameLikes(username, { limit, offset }, undefined, signal),
    pageSize: PAGE,
    enabled: !isPrivate,
  });
  if (isPrivate) return <PrivateNotice />;
  if (likes.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (likes.items.length === 0)
    return <div className="panel p-12 text-center text-dimmed">{t("profile.likes.empty")}</div>;
  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {likes.items.map((game) => (
          <GameCard key={game.id} game={game} grade={byGameId.get(game.id)?.userGameData.grade} />
        ))}
      </div>
      <div className="mt-3">
        <LoadMore {...likes} />
      </div>
    </>
  );
}
