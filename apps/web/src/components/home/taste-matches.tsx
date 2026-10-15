import type { TasteMatch } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { GameCover } from "@/components/game/game-cover";
import { Rail } from "@/components/rail";
import { UserAvatar } from "@/components/user-avatar";
import { IgdbSize } from "@/lib/enums";

/** Members whose grades agree with the viewer's: how much, on how many games, and the shared games both graded highest */
export function TasteMatches({ matches }: { matches: TasteMatch[] }) {
  const { t } = useTranslation();
  return (
    <Rail itemClassName="basis-56">
      {matches.map((match) => (
        <Link
          key={match.id}
          to="/$username"
          params={{ username: match.username ?? "" }}
          className="panel flex h-full flex-col gap-3 p-3 hover:border-white/30"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <UserAvatar user={match} className="size-8" textClassName="text-xs" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{match.name}</div>
              {match.username && (
                <div className="num truncate text-xs text-dimmed">@{match.username}</div>
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="num text-3xl font-extrabold">{match.agreement}%</span>
            <span className="text-xs text-dimmed">
              {t("home.taste.inCommon", { count: match.shared })}
            </span>
          </div>
          <div className="flex gap-1.5">
            {match.games.map((g) => (
              <GameCover
                key={g.id}
                url={g.cover?.url}
                name={g.name}
                size={IgdbSize.CoverSmall}
                className="w-10"
              />
            ))}
          </div>
        </Link>
      ))}
    </Rail>
  );
}
