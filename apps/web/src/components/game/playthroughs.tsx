import {
  useGetApiUserByUsernameGamesByIdPlaythroughs,
  type GamePlatform,
} from "@playdamnit/api-client";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlaythroughMutations } from "@/hooks/social";
import { shortDate } from "@/lib/format";

interface PlaythroughsProps {
  username: string;
  gameId: number;
  platforms: GamePlatform[];
  defaultPlatformId?: number | null;
}

/** The entry's playthroughs (replays, hours, dates) with a small form to log another */
export function Playthroughs({
  username,
  gameId,
  platforms,
  defaultPlatformId,
}: PlaythroughsProps) {
  const { t } = useTranslation();
  const runs = useGetApiUserByUsernameGamesByIdPlaythroughs(username, gameId);
  const mutations = usePlaythroughMutations(gameId);
  const [adding, setAdding] = useState(false);
  const [startedAt, setStartedAt] = useState("");
  const [endedAt, setEndedAt] = useState("");
  const [hours, setHours] = useState("");
  const [platformId, setPlatformId] = useState(String(defaultPlatformId ?? platforms[0]?.id ?? ""));
  const [note, setNote] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await mutations.add({
      startedAt: startedAt || null,
      endedAt: endedAt || null,
      hours: hours ? Number(hours) : null,
      platformId: platformId ? Number(platformId) : null,
      note: note || null,
    });
    setAdding(false);
    setStartedAt("");
    setEndedAt("");
    setHours("");
    setNote("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{t("playthrough.title")}</Label>
        {!adding && (
          <Button type="button" variant="ghost" size="xs" onClick={() => setAdding(true)}>
            <PlusIcon /> {t("playthrough.log")}
          </Button>
        )}
      </div>
      {runs.data?.length === 0 && !adding && (
        <p className="text-xs text-dimmed">{t("playthrough.empty")}</p>
      )}
      <ul className="space-y-1.5">
        {runs.data?.map((run) => (
          <li
            key={run.id}
            className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2 text-sm"
          >
            <div className="min-w-0 flex-1">
              <div>
                {[shortDate(run.startedAt), shortDate(run.endedAt)].filter(Boolean).join(" → ") ||
                  t("playthrough.undated")}
                {run.hours ? (
                  <span className="text-dimmed"> · {t("units.hours", { value: run.hours })}</span>
                ) : null}
                {run.platform && (
                  <span className="text-dimmed">
                    {" "}
                    · {run.platform.abbreviation ?? run.platform.name}
                  </span>
                )}
              </div>
              {run.note && <div className="truncate text-xs text-dimmed">{run.note}</div>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t("playthrough.deleteAria")}
              className="text-dimmed hover:text-destructive"
              onClick={() => mutations.remove(run.id)}
            >
              <Trash2Icon />
            </Button>
          </li>
        ))}
      </ul>
      {adding && (
        <form
          onSubmit={submit}
          className="grid gap-3 rounded-lg border border-white/10 p-3 sm:grid-cols-2"
        >
          <div className="space-y-1">
            <Label htmlFor="pt-start" className="text-xs">
              {t("playthrough.started")}
            </Label>
            <Input
              id="pt-start"
              type="date"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pt-end" className="text-xs">
              {t("playthrough.finished")}
            </Label>
            <Input
              id="pt-end"
              type="date"
              value={endedAt}
              onChange={(e) => setEndedAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pt-hours" className="text-xs">
              {t("playthrough.hours")}
            </Label>
            <Input
              id="pt-hours"
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("log.platform")}</Label>
            <Select value={platformId} onValueChange={setPlatformId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("log.platform")} />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="pt-note" className="text-xs">
              {t("playthrough.note")}
            </Label>
            <Input
              id="pt-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("playthrough.notePlaceholder")}
              maxLength={1000}
            />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={mutations.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
