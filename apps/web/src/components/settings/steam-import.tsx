import {
  getGetApiUserByUsernameGamesQueryKey,
  StatusEnum,
  usePostApiMeImportSteam,
  usePostApiMeImportSteamPreview,
  type SteamImportPreview,
} from "@playdamnit/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";

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
import { statusMeta } from "@/lib/statuses";

const apiMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// Where games with Steam playtime can go; never-launched ones always go to the backlog
const PLAYED_STATUSES = [
  StatusEnum.OnHold,
  StatusEnum.Playing,
  StatusEnum.Finished,
  StatusEnum.Dropped,
] as const;

/**
 * Import a Steam library: paste a profile, see what would come in (and how much of it was
 * never launched), pick where played games go, import.
 */
export function SteamImport({ username }: { username: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState("");
  const [preview, setPreview] = useState<SteamImportPreview | null>(null);
  const [playedStatus, setPlayedStatus] = useState<StatusEnum>(StatusEnum.OnHold);

  const check = usePostApiMeImportSteamPreview({
    mutation: {
      onSuccess: setPreview,
      onError: (error) => {
        setPreview(null);
        toast.error(apiMessage(error, t("settings.steam.checkFailed")));
      },
    },
  });
  const run = usePostApiMeImportSteam({
    mutation: {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameGamesQueryKey(username) });
        toast.success(
          t("toast.imported", {
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors,
          }),
        );
        setPreview(null);
      },
      onError: (error) => toast.error(apiMessage(error, t("toast.importFailed"))),
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (profile.trim()) check.mutate({ data: { profile: profile.trim() } });
  };

  return (
    <section className="panel space-y-4 p-5 md:col-span-2">
      <h3 className="font-semibold">{t("settings.steam.title")}</h3>
      <p className="text-sm text-dimmed">{t("settings.steam.text")}</p>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <Input
          value={profile}
          onChange={(e) => {
            setProfile(e.target.value);
            setPreview(null);
          }}
          placeholder={t("settings.steam.placeholder")}
          aria-label={t("settings.steam.placeholder")}
          className="min-w-0 flex-1 basis-64"
        />
        <Button type="submit" variant="secondary" disabled={check.isPending || !profile.trim()}>
          {check.isPending ? t("settings.steam.checking") : t("settings.steam.check")}
        </Button>
      </form>

      {preview && (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-[15px]">
            <Trans
              i18nKey="settings.steam.summary"
              values={{
                owned: preview.owned,
                hours: preview.hoursPlayed,
                never: preview.neverPlayed,
              }}
              components={{ n: <b className="num" />, bad: <b className="num text-signal" /> }}
            />
          </p>
          <ul className="grid gap-1 text-sm text-dimmed sm:grid-cols-2">
            <li>{t("settings.steam.toImport", { count: preview.toImport })}</li>
            <li>{t("settings.steam.already", { count: preview.alreadyInLibrary })}</li>
            <li>{t("settings.steam.unmatched", { count: preview.unmatched })}</li>
          </ul>
          {preview.mostPlayed.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="eyebrow self-center">{t("settings.steam.mostPlayed")}</span>
              {preview.mostPlayed.map((g) => (
                <Link
                  key={g.gameId}
                  to="/games/$id"
                  params={{ id: String(g.gameId) }}
                  className="border border-border px-2 py-1 hover:border-foreground/40"
                >
                  {g.name}{" "}
                  <span className="num text-dimmed">
                    {t("settings.steam.hours", { count: g.hours })}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {preview.toImport > 0 && (
            <div className="flex flex-wrap items-end gap-3">
              {preview.played > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="steam-played">
                    {t("settings.steam.playedAs", { count: preview.played })}
                  </Label>
                  <Select
                    value={playedStatus}
                    onValueChange={(v) => setPlayedStatus(v as StatusEnum)}
                  >
                    <SelectTrigger id="steam-played" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PLAYED_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {statusMeta(s).label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button
                onClick={() => run.mutate({ data: { profile: profile.trim(), playedStatus } })}
                disabled={run.isPending}
              >
                {run.isPending
                  ? t("settings.data.importing")
                  : t("settings.steam.import", { count: preview.toImport })}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
