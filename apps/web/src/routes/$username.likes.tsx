import { useGetApiUserByUsernameLikes } from "@playdamnit/api-client";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { GameCard } from "@/components/game/game-card";
import { PrivateNotice } from "@/components/profile/private-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyLibrary } from "@/hooks/library";
import { useProfileContext } from "@/hooks/profile";
import { gradeOf } from "@/lib/grade";

export const Route = createFileRoute("/$username/likes")({
  component: ProfileLikes,
});

function ProfileLikes() {
  const { t } = useTranslation();
  const { username, isPrivate } = useProfileContext();
  const { byGameId } = useMyLibrary();
  const likes = useGetApiUserByUsernameLikes(
    username,
    { limit: 100 },
    { query: { enabled: !isPrivate } },
  );
  if (isPrivate) return <PrivateNotice />;
  if (likes.isPending) return <Skeleton className="h-40 rounded-card" />;
  if (!likes.data || likes.data.results.length === 0)
    return <div className="panel p-12 text-center text-dimmed">{t("profile.likes.empty")}</div>;
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {likes.data.results.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          grade={gradeOf(byGameId.get(game.id)?.userGameData.rating)}
        />
      ))}
    </div>
  );
}
