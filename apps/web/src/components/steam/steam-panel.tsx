import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSteam } from "./use-steam";

/** A Steam profile field and an Import button; importing also links the account */
export function SteamImportForm({
  username,
  onImported,
}: {
  username: string;
  onImported?: () => void;
}) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState("");
  const steam = useSteam(username, onImported);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (profile.trim()) steam.importLibrary(profile);
      }}
      className="flex flex-wrap gap-2"
    >
      <Input
        value={profile}
        onChange={(e) => setProfile(e.target.value)}
        placeholder={t("steam.placeholder")}
        aria-label={t("steam.placeholder")}
        className="min-w-0 flex-1 basis-56"
      />
      <Button type="submit" disabled={steam.pending || !profile.trim()}>
        {steam.pending ? t("steam.importing") : t("steam.import")}
      </Button>
    </form>
  );
}

/** Settings: the import form, or the linked account with Sync and Unlink */
export function SteamSettings({
  username,
  steamId,
}: {
  username: string;
  steamId?: string | null;
}) {
  const { t } = useTranslation();
  const steam = useSteam(username);
  if (!steamId) return <SteamImportForm username={username} />;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-auto text-sm">{t("steam.connected")}</span>
      <Button variant="secondary" onClick={() => steam.importLibrary()} disabled={steam.pending}>
        {steam.pending ? t("steam.importing") : t("steam.syncNow")}
      </Button>
      <Button variant="ghost" className="text-dimmed hover:text-destructive" onClick={steam.unlink}>
        {t("steam.unlink")}
      </Button>
    </div>
  );
}
