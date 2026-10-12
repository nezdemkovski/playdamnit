import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SteamImportForm } from "./steam-panel";

/** "Connect Steam" for an owner without a linked library; once linked, the badge takes over */
export function SteamButton({ username, steamId }: { username: string; steamId?: string | null }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (steamId) return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RefreshCwIcon /> {t("steam.connect")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-card border-white/5 bg-popover sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("steam.title")}</DialogTitle>
          </DialogHeader>
          <SteamImportForm username={username} onImported={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
