import type { GameListSummary } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { GameCover } from "@/components/game/game-cover";

/** A list as a stack of its first covers plus name and size */
export function ListCard({ list }: { list: GameListSummary }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/lists/$id"
      params={{ id: list.id }}
      className="panel group block p-4 transition-colors hover:bg-white/[0.05]"
    >
      <div className="flex h-24 items-end">
        {list.covers.length === 0 ? (
          <div className="cover h-full w-[4.5rem]" />
        ) : (
          list.covers.map((cover, i) => (
            <div
              key={cover.id ?? i}
              className="-ml-6 w-[4.5rem] shadow-xl first:ml-0"
              style={{ zIndex: 10 - i }}
            >
              <GameCover url={cover.url} name="" />
            </div>
          ))
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 font-bold group-hover:underline">
        {list.name}
        {!list.isPublic && <LockIcon className="size-3.5 text-dimmed" />}
      </div>
      <div className="text-xs text-dimmed">
        {t("lists.games", { count: list.gamesCount })}
        {list.user?.username && <> · @{list.user.username}</>}
      </div>
      {list.description && (
        <p className="mt-1 line-clamp-2 text-sm text-white/70">{list.description}</p>
      )}
    </Link>
  );
}
