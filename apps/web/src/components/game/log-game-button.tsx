import type { Game, UserGameData } from "@playdamnit/api-client";
import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { LogGameDialog } from "./log-game-dialog";
import { GradeBadge, StatusPill } from "./rating";
import { PillSize } from "@/lib/enums";
import { gradeOf } from "@/lib/grade";
import type { ComponentProps } from "react";

type ButtonProps = ComponentProps<typeof Button>;

interface LogGameButtonProps {
  game: Pick<Game, "id" | "name" | "cover" | "platforms" | "firstReleaseDate">;
  entry?: UserGameData | null;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}

/** "+ Add game" or the current rating/status with an edit affordance; opens the log dialog */
export function LogGameButton({
  game,
  entry,
  size = "default",
  variant = "default",
}: LogGameButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      {entry ? (
        <Button variant="secondary" size={size} onClick={() => setOpen(true)} className="gap-2">
          <GradeBadge grade={gradeOf(entry.rating)} size={PillSize.Sm} />
          <StatusPill status={entry.status} />
          <PencilIcon className="size-3.5 text-dimmed" />
        </Button>
      ) : (
        <Button variant={variant} size={size} onClick={() => setOpen(true)}>
          <PlusIcon /> {t("log.add")}
        </Button>
      )}
      <LogGameDialog game={game} entry={entry} open={open} onOpenChange={setOpen} />
    </>
  );
}
