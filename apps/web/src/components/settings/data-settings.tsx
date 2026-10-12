import { DownloadIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getConfig } from "@/config";
import { useLibraryMutations } from "@/hooks/library";
import { SteamSettings } from "@/components/steam/steam-panel";
import {
  GetApiUserByUsernameGamesExportFormat,
  useGetApiUserByUsername,
} from "@playdamnit/api-client";

/** Export the list as JSON or CSV, import a file exported here (or a hand-made one) */
export function DataSettings({ username }: { username: string }) {
  const { t } = useTranslation();
  const library = useLibraryMutations();
  const profile = useGetApiUserByUsername(username);
  const [overwrite, setOverwrite] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportUrl = (format: GetApiUserByUsernameGamesExportFormat) =>
    `${getConfig().apiUrl}/api/user/${encodeURIComponent(username)}/games/export?format=${format}&download=true`;

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("overwriteExisting", String(overwrite));
    await library.importFile(form);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section className="panel space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <DownloadIcon className="size-4 text-dimmed" /> {t("settings.data.export")}
        </h3>
        <p className="text-sm text-dimmed">{t("settings.data.exportText")}</p>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <a href={exportUrl(GetApiUserByUsernameGamesExportFormat.Json)}>JSON</a>
          </Button>
          <Button asChild variant="secondary">
            <a href={exportUrl(GetApiUserByUsernameGamesExportFormat.Csv)}>CSV</a>
          </Button>
        </div>
      </section>
      <section className="panel space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <UploadIcon className="size-4 text-dimmed" /> {t("settings.data.import")}
        </h3>
        <p className="text-sm text-dimmed">{t("settings.data.importText")}</p>
        <div className="flex items-center gap-3">
          <Switch id="overwrite" checked={overwrite} onCheckedChange={setOverwrite} />
          <Label htmlFor="overwrite">{t("settings.data.overwrite")}</Label>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <Button onClick={() => fileInput.current?.click()} disabled={library.importPending}>
          {library.importPending ? t("settings.data.importing") : t("settings.data.chooseFile")}
        </Button>
      </section>
      <section className="panel space-y-4 p-5 md:col-span-2">
        <h3 className="font-semibold">{t("steam.title")}</h3>
        <SteamSettings username={username} steamId={profile.data?.steamId} />
      </section>
    </div>
  );
}
