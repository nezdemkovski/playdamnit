import { useGetApiListsById, type Game } from "@playdamnit/api-client";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { GameCard } from "@/components/game/game-card";
import { GameCover } from "@/components/game/game-cover";
import { ListFormDialog } from "@/components/lists/list-form-dialog";
import { Markdown } from "@/components/markdown";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useSession } from "@/hooks/auth";
import { useMyLibrary } from "@/hooks/library";
import { useListMutations } from "@/hooks/social";
import { releaseYear } from "@/lib/format";
import { AddGamePicker } from "@/components/lists/add-game-picker";

export const Route = createFileRoute("/lists/$id")({
  component: ListPage,
});

function ListPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const { byGameId } = useMyLibrary();
  const list = useGetApiListsById(id);
  const mutations = useListMutations();
  const [editing, setEditing] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [order, setOrder] = useState<Game[]>([]);

  const isOwn = !!list.data?.user && list.data.user.id === user?.id;

  useEffect(() => {
    if (list.data) setOrder(list.data.games);
  }, [list.data]);

  if (list.error) {
    return (
      <div className="panel mt-10 p-16 text-center text-dimmed">
        {t("lists.page.notFound")}
        <div className="mt-4">
          <Link to="/" className="font-semibold text-white hover:underline">
            {t("notFound.back")}
          </Link>
        </div>
      </div>
    );
  }
  if (list.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-64 rounded-card" />
      </div>
    );
  }
  const data = list.data;
  const username = data.user?.username ?? "";

  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };
  const saveOrder = async () => {
    await mutations.setGames(
      id,
      order.map((g) => g.id),
    );
    setArranging(false);
  };

  return (
    <>
      <header className="panel p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {data.name}
              {!data.isPublic && <LockIcon className="size-4 text-dimmed" />}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-dimmed">
              {data.user && (
                <Link
                  to="/$username"
                  params={{ username }}
                  className="flex items-center gap-2 hover:text-white"
                >
                  <UserAvatar user={data.user} className="size-6" textClassName="text-xs" />
                  {data.user.name || username}
                </Link>
              )}
              <span>· {t("lists.games", { count: data.gamesCount })}</span>
            </div>
            {data.description && (
              <Markdown className="mt-3 max-w-2xl text-white/80">{data.description}</Markdown>
            )}
          </div>
          {isOwn && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon /> {t("common.edit")}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setArranging((v) => !v)}
                disabled={data.games.length < 2}
              >
                {arranging ? t("lists.page.doneArranging") : t("lists.page.arrange")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon /> {t("common.delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t("lists.page.deleteTitle", { name: data.name })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{t("lists.page.deleteText")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.keep")}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={async () => {
                        await mutations.remove(id);
                        navigate({ to: "/$username", params: { username } });
                      }}
                    >
                      {t("common.delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </header>

      {isOwn && (
        <div className="mt-4">
          <AddGamePicker
            exclude={new Set(data.games.map((g) => g.id))}
            onPick={(gameId) => mutations.addGame(id, gameId)}
          >
            <Button variant="outline" size="sm">
              <PlusIcon /> {t("lists.page.addGame")}
            </Button>
          </AddGamePicker>
        </div>
      )}

      {arranging ? (
        <div className="mt-6 space-y-2">
          {order.map((game, i) => (
            <div key={game.id} className="panel flex items-center gap-3 p-2 pr-3">
              <span className="w-8 text-center text-sm font-bold tabular-nums text-dimmed">
                {i + 1}
              </span>
              <GameCover
                url={game.cover?.url}
                name={game.name}
                size="cover_small"
                className="w-10 rounded-md"
              />
              <div className="min-w-0 flex-1 truncate font-semibold">{game.name}</div>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("lists.page.moveUp")}
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("lists.page.moveDown")}
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={t("common.remove")}
                className="text-dimmed hover:text-destructive"
                onClick={() => setOrder(order.filter((g) => g.id !== game.id))}
              >
                <XIcon />
              </Button>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOrder(data.games);
                setArranging(false);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={saveOrder} disabled={mutations.isPending}>
              {t("lists.page.saveOrder")}
            </Button>
          </div>
        </div>
      ) : data.games.length === 0 ? (
        <div className="panel mt-6 p-12 text-center text-dimmed">{t("lists.page.empty")}</div>
      ) : (
        <ol className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {data.games.map((game, i) => (
            <li key={game.id}>
              <GameCard game={game} rating={byGameId.get(game.id)?.userGameData.rating} />
              <div className="mt-1.5 flex gap-1.5 text-xs">
                <span className="font-bold tabular-nums text-dimmed">{i + 1}</span>
                <span className="line-clamp-2 font-semibold">{game.name}</span>
              </div>
              {releaseYear(game.firstReleaseDate) && (
                <div className="text-xs text-dimmed">{releaseYear(game.firstReleaseDate)}</div>
              )}
            </li>
          ))}
        </ol>
      )}

      <ListFormDialog
        open={editing}
        onOpenChange={setEditing}
        list={data}
        onSubmit={(input) => mutations.update(id, input)}
      />
    </>
  );
}
