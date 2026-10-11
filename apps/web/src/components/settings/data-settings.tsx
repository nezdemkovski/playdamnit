import { DownloadIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getConfig } from "@/config";
import { useLibraryMutations } from "@/hooks/library";

/** Export the list as JSON or CSV, import a file exported here (or a hand-made one) */
export function DataSettings({ username }: { username: string }) {
  const library = useLibraryMutations();
  const [overwrite, setOverwrite] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportUrl = (format: "json" | "csv") =>
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
          <DownloadIcon className="size-4 text-dimmed" /> Export
        </h3>
        <p className="text-sm text-dimmed">
          Download your whole list with ratings, statuses, reviews and dates.
        </p>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <a href={exportUrl("json")}>JSON</a>
          </Button>
          <Button asChild variant="secondary">
            <a href={exportUrl("csv")}>CSV</a>
          </Button>
        </div>
      </section>
      <section className="panel space-y-4 p-5">
        <h3 className="flex items-center gap-2 font-semibold">
          <UploadIcon className="size-4 text-dimmed" /> Import
        </h3>
        <p className="text-sm text-dimmed">
          A JSON or CSV file in the export format (IGDB game ids, status, rating, platform). Up to
          1000 games.
        </p>
        <div className="flex items-center gap-3">
          <Switch id="overwrite" checked={overwrite} onCheckedChange={setOverwrite} />
          <Label htmlFor="overwrite">Overwrite games already in the list</Label>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <Button onClick={() => fileInput.current?.click()} disabled={library.importPending}>
          {library.importPending ? "Importing…" : "Choose a file"}
        </Button>
      </section>
    </div>
  );
}
