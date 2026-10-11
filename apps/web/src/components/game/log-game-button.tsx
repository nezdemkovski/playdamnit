import type { Game, UserGameData } from "@playdamnit/api-client";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LogGameDialog } from "./log-game-dialog";
import { RatingValue, StatusPill } from "./rating";

interface LogGameButtonProps {
  game: Pick<Game, "id" | "name" | "cover" | "platforms" | "firstReleaseDate">;
  entry?: UserGameData | null;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost";
}

/** "+ Add game" or the current rating/status with an edit affordance; opens the log dialog */
export function LogGameButton({
  game,
  entry,
  size = "default",
  variant = "default",
}: LogGameButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {entry ? (
        <Button variant="secondary" size={size} onClick={() => setOpen(true)} className="gap-2">
          <RatingValue value={entry.rating} className="text-base" />
          <StatusPill status={entry.status} />
          <PencilIcon className="size-3.5 text-dimmed" />
        </Button>
      ) : (
        <Button variant={variant} size={size} onClick={() => setOpen(true)}>
          <PlusIcon /> Add game
        </Button>
      )}
      <LogGameDialog game={game} entry={entry} open={open} onOpenChange={setOpen} />
    </>
  );
}
