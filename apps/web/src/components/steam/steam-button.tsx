import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SteamPanel } from "./steam-panel";

/** The owner's Steam control in the profile header: connect, or sync the linked library */
export function SteamButton({
  username,
  steamId,
  steamSyncedAt,
}: {
  username: string;
  steamId?: string | null;
  steamSyncedAt?: string | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RefreshCwIcon /> {steamId ? t("steam.sync") : t("steam.connect")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-card border-white/5 bg-popover sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("steam.title")}</DialogTitle>
            <DialogDescription>{t("steam.text")}</DialogDescription>
          </DialogHeader>
          <SteamPanel
            username={username}
            steamId={steamId}
            steamSyncedAt={steamSyncedAt}
            onImported={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
