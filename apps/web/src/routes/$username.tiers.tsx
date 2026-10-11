import type { UserGameWithUserData } from "@playdamnit/api-client";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "cn";

import { GameCover } from "@/components/game/game-cover";
import { PrivateNotice } from "@/components/profile/private-notice";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileContext } from "@/hooks/profile";
import { useLibraryMutations } from "@/hooks/library";
import { DragDataType, Grade } from "@/lib/enums";
import { GRADES, gradeOf, ratingOf } from "@/lib/grade";

export const Route = createFileRoute("/$username/tiers")({ component: ProfileTiers });

/** The whole tier board stays visible; the pool uses the same compact covers. */
function ProfileTiers() {
  const { t } = useTranslation();
  const { entries, library, isOwn, isPrivate } = useProfileContext();
  const mutations = useLibraryMutations();
  const moving = useRef(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const selected = entries.find((e) => e.id === selectedId);
  const ungraded = entries.filter((e) => !gradeOf(e.userGameData.rating));
  const pool = ungraded.filter((e) =>
    e.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  const move = async (id: number | null, grade: Grade | null) => {
    const entry = entries.find((e) => e.id === id);
    if (!isOwn || !entry || moving.current || gradeOf(entry.userGameData.rating) === grade) return;
    moving.current = true;
    setSelectedId(id);
    try {
      await mutations.update(entry.id, { rating: ratingOf(grade) });
      setSelectedId(null);
    } catch {
      // Keep the selection for retry. The existing mutation hook shows the error.
    } finally {
      moving.current = false;
      setDraggedId(null);
    }
  };

  const tile = (game: UserGameWithUserData) => {
    const content = (
      <>
        <GameCover url={game.cover?.url} name={game.name} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/80 px-0.5 py-0.5 text-center text-[9px] font-semibold leading-[1.15] text-white">
          <span className="line-clamp-2">{game.name}</span>
        </span>
      </>
    );
    const className = cn(
      "relative block w-12 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-[52px]",
      selectedId === game.id && "z-10 ring-2 ring-foreground",
      draggedId === game.id && "opacity-40",
    );
    return isOwn ? (
      <button
        key={game.id}
        type="button"
        title={game.name}
        aria-label={t("profile.tiers.selectGame", { name: game.name })}
        aria-pressed={selectedId === game.id}
        disabled={mutations.isPending}
        draggable={!mutations.isPending}
        onClick={() => setSelectedId(selectedId === game.id ? null : game.id)}
        onDragStart={(event) => {
          event.dataTransfer.setData(DragDataType.Text, String(game.id));
          event.dataTransfer.effectAllowed = "move";
          setDraggedId(game.id);
          setSelectedId(game.id);
        }}
        onDragEnd={() => setDraggedId(null)}
        className={cn(className, "cursor-grab disabled:cursor-wait active:cursor-grabbing")}
      >
        {content}
      </button>
    ) : (
      <Link
        key={game.id}
        to="/games/$id"
        params={{ id: String(game.id) }}
        title={game.name}
        className={className}
      >
        {content}
      </Link>
    );
  };

  if (isPrivate) return <PrivateNotice />;
  if (library.isPending) return <Skeleton className="h-96" />;
  if (library.isError)
    return (
      <p role="alert" className="py-8 text-dimmed">
        {t("profile.tiers.loadError")}
      </p>
    );

  return (
    <div>
      <div className="mb-4 flex min-h-9 flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-dimmed">
          {mutations.isPending
            ? t("profile.tiers.saving")
            : selected
              ? t("profile.tiers.moveHint", { name: selected.name })
              : isOwn
                ? t("profile.tiers.boardHint")
                : t("profile.tiers.summary", {
                    graded: entries.length - ungraded.length,
                    ungraded: ungraded.length,
                  })}
        </p>
        {selected && (
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-sm text-dimmed hover:text-foreground"
          >
            {t("common.cancel")}
          </button>
        )}
      </div>
      <div className="space-y-px border border-border bg-border">
        {GRADES.map((meta) => {
          const games = entries.filter((e) => gradeOf(e.userGameData.rating) === meta.value);
          return (
            <section
              key={meta.value}
              aria-label={t("profile.tiers.rowLabel", { grade: meta.value })}
              className="grid grid-cols-[44px_minmax(0,1fr)] gap-px sm:grid-cols-[48px_minmax(0,1fr)]"
              onDragOver={(event) => {
                if (draggedId !== null) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                void move(draggedId, meta.value);
              }}
            >
              <button
                type="button"
                disabled={!isOwn || !selected || mutations.isPending}
                onClick={() => void move(selectedId, meta.value)}
                style={{ background: meta.fill }}
                title={meta.name}
                aria-label={t("profile.tiers.moveTo", { grade: meta.value })}
                className={cn(
                  "flex min-h-[72px] items-center justify-center font-display text-xl text-black outline-none focus-visible:ring-2 focus-visible:ring-foreground sm:min-h-[78px]",
                  isOwn && selected && "cursor-pointer hover:brightness-110",
                )}
              >
                {meta.value}
              </button>
              <div
                className={cn(
                  "flex min-w-0 flex-wrap content-start items-start gap-1 bg-card p-1",
                  draggedId !== null && "ring-1 ring-inset ring-border",
                )}
              >
                {games.map(tile)}
              </div>
            </section>
          );
        })}
      </div>
      <section
        className="mt-3"
        aria-label={t("profile.tiers.pool")}
        onDragOver={(event) => {
          if (draggedId !== null) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          void move(draggedId, null);
        }}
      >
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 className="text-base font-bold">
            {t("profile.tiers.pool")}{" "}
            <span className="num ml-1 text-sm text-dimmed">{ungraded.length}</span>
          </h2>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("profile.tiers.filterPool")}
            aria-label={t("profile.tiers.filterPool")}
            className="h-9 w-48 text-sm sm:w-64"
          />
          {isOwn && selected && gradeOf(selected.userGameData.rating) && (
            <button
              type="button"
              disabled={mutations.isPending}
              onClick={() => void move(selectedId, null)}
              className="text-sm text-dimmed hover:text-foreground"
            >
              {t("profile.tiers.returnToPool")}
            </button>
          )}
        </div>
        <div
          className={cn(
            "flex min-h-20 flex-wrap content-start gap-1 bg-card p-1",
            draggedId !== null && "ring-1 ring-inset ring-border",
          )}
        >
          {pool.map(tile)}
          {!pool.length && (
            <p className="self-center px-3 py-5 text-sm text-dimmed">
              {query ? t("profile.tiers.noMatches") : t("profile.tiers.emptyPool")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
