import { useGetApiGamesByIdLists } from "@playdamnit/api-client";
import { useNavigate } from "@tanstack/react-router";
import { ListPlusIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSession } from "@/hooks/auth";
import { useListMutations } from "@/hooks/social";

/** Toggle the game in each of the viewer's lists, or create a new list with it */
export function ManageListsButton({ gameId, gameName }: { gameId: number; gameName: string }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const lists = useGetApiGamesByIdLists(gameId, { query: { enabled: open && !!user } });
  const mutations = useListMutations();

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    const list = await mutations.create({ name });
    await mutations.addGame(list.id, gameId);
    setNewName("");
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => (user ? setOpen(true) : navigate({ to: "/auth" }))}
      >
        <ListPlusIcon /> Lists
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-card border-white/5 bg-popover">
          <DialogHeader>
            <DialogTitle>Manage lists</DialogTitle>
            <DialogDescription>Add {gameName} to your lists.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {lists.data?.length === 0 && (
              <p className="text-sm text-dimmed">You have no lists yet.</p>
            )}
            {lists.data?.map((list) => (
              <label
                key={list.id}
                className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-white/5"
              >
                <span className="truncate">
                  {list.name}
                  {!list.isPublic && <span className="ml-2 text-xs text-dimmed">private</span>}
                </span>
                <Switch
                  checked={list.contains}
                  disabled={mutations.isPending}
                  onCheckedChange={(on) =>
                    on ? mutations.addGame(list.id, gameId) : mutations.removeGame(list.id, gameId)
                  }
                />
              </label>
            ))}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New list name"
              maxLength={100}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!newName.trim() || mutations.isPending}
              aria-label="Create list"
            >
              <PlusIcon />
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
