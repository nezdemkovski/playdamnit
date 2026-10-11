import type { UserGameWithUserData } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import { Gamepad2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { GameCover } from "@/components/game/game-cover";
import { Input } from "@/components/ui/input";
import { useLibraryMutations } from "@/hooks/library";
import { DragDataType, Grade } from "@/lib/enums";
import { GRADES, gradeOf, ratingOf } from "@/lib/grade";

interface TierBoardProps {
  entries: UserGameWithUserData[];
  /** Arrange mode for the owner: drag or select-and-tap, plus the pool of ungraded games */
  arranging?: boolean;
}

/**
 * The library as a tier board, one row per grade. Read-only by default (covers link to
 * games); in arrange mode a game can be dragged into a row, or selected and a row tapped,
 * and the ungraded pool appears underneath.
 */
export function TierBoard({ entries, arranging = false }: TierBoardProps) {
  const { t } = useTranslation();
  const mutations = useLibraryMutations();
  const moving = useRef(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const selected = arranging ? entries.find((e) => e.id === selectedId) : undefined;
  const ungraded = entries.filter((e) => !gradeOf(e.userGameData.rating));
  const pool = ungraded.filter((e) =>
    e.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  const move = async (id: number | null, grade: Grade | null) => {
    const entry = entries.find((e) => e.id === id);
    if (!arranging || !entry || moving.current || gradeOf(entry.userGameData.rating) === grade)
      return;
    moving.current = true;
    setSelectedId(id);
    try {
      await mutations.update(entry.id, { rating: ratingOf(grade) });
      setSelectedId(null);
    } catch {
      // Keep the selection for retry. The mutation hook shows the error.
    } finally {
      moving.current = false;
      setDraggedId(null);
    }
  };

  const dropHandlers = (grade: Grade | null) =>
    arranging
      ? {
          onDragOver: (event: React.DragEvent) => {
            if (draggedId !== null) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          },
          onDrop: (event: React.DragEvent) => {
            event.preventDefault();
            void move(draggedId, grade);
          },
        }
      : {};

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
    return arranging ? (
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
        className={cn(className, "hover:z-10 hover:ring-2 hover:ring-foreground")}
      >
        {content}
      </Link>
    );
  };

  return (
    <div>
      {arranging && (
        <div className="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-dimmed">
            {mutations.isPending
              ? t("profile.tiers.saving")
              : selected
                ? t("profile.tiers.moveHint", { name: selected.name })
                : t("profile.tiers.boardHint")}
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
      )}
      <div className="space-y-px border border-border bg-border">
        {GRADES.map((meta) => {
          const games = entries.filter((e) => gradeOf(e.userGameData.rating) === meta.value);
          return (
            <section
              key={meta.value}
              aria-label={t("profile.tiers.rowLabel", { grade: meta.value })}
              className="grid grid-cols-[44px_minmax(0,1fr)] gap-px sm:grid-cols-[48px_minmax(0,1fr)]"
              {...dropHandlers(meta.value)}
            >
              {arranging ? (
                <button
                  type="button"
                  disabled={!selected || mutations.isPending}
                  onClick={() => void move(selectedId, meta.value)}
                  style={{ background: meta.fill }}
                  title={meta.name}
                  aria-label={t("profile.tiers.moveTo", { grade: meta.value })}
                  className={cn(
                    "flex min-h-[72px] items-center justify-center font-display text-xl text-black outline-none focus-visible:ring-2 focus-visible:ring-foreground sm:min-h-[78px]",
                    selected && "cursor-pointer hover:brightness-110",
                  )}
                >
                  {meta.value}
                </button>
              ) : (
                <div
                  style={{ background: meta.fill }}
                  title={meta.name}
                  className="flex min-h-[72px] items-center justify-center font-display text-xl text-black sm:min-h-[78px]"
                >
                  {meta.value}
                </div>
              )}
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
      {arranging && (
        <section className="mt-3" aria-label={t("profile.tiers.pool")} {...dropHandlers(null)}>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h3 className="text-base font-bold">
              {t("profile.tiers.pool")}{" "}
              <span className="num ml-1 text-sm text-dimmed">{ungraded.length}</span>
            </h3>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("profile.tiers.filterPool")}
              aria-label={t("profile.tiers.filterPool")}
              className="h-9 w-48 text-sm sm:w-64"
            />
            {selected && gradeOf(selected.userGameData.rating) && (
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
              "flex min-h-20 flex-wrap content-start gap-1 p-1",
              pool.length
                ? "bg-card"
                : "items-center justify-center border border-dashed border-border",
              draggedId !== null && "ring-1 ring-inset ring-border",
            )}
            aria-label={pool.length ? undefined : t("profile.tiers.emptyPool")}
          >
            {pool.map(tile)}
            {!pool.length && (
              <Gamepad2Icon className="size-5 text-dimmed/50" strokeWidth={1.5} aria-hidden />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
