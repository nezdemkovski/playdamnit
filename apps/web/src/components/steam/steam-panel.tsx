import {
  getGetApiUserByUsernameGamesQueryKey,
  getGetApiUserByUsernameQueryKey,
  StatusEnum,
  useDeleteApiMeSteam,
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
import { relativeDate } from "@/lib/format";
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

interface SteamPanelProps {
  username: string;
  /** The linked SteamID64, when the account is connected */
  steamId?: string | null;
  steamSyncedAt?: string | null;
  /** Called after a successful import (e.g. to close a dialog) */
  onImported?: () => void;
}

/**
 * Connect a Steam account and bring its library in. Not linked: paste a profile, check,
 * import (which links it). Linked: check for new games and import them again any time, or
 * unlink. The preview always shows what would happen before anything is written.
 */
export function SteamPanel({ username, steamId, steamSyncedAt, onImported }: SteamPanelProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState("");
  const [changing, setChanging] = useState(false);
  const [preview, setPreview] = useState<SteamImportPreview | null>(null);
  const [playedStatus, setPlayedStatus] = useState<StatusEnum>(StatusEnum.OnHold);
  const linked = !!steamId && !changing;
  // A linked account syncs without a profile; otherwise the pasted one is used
  const body = () => (linked ? {} : { profile: profile.trim() });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameGamesQueryKey(username) });
    queryClient.invalidateQueries({ queryKey: getGetApiUserByUsernameQueryKey(username) });
  };

  const check = usePostApiMeImportSteamPreview({
    mutation: {
      onSuccess: setPreview,
      onError: (error) => {
        setPreview(null);
        toast.error(apiMessage(error, t("steam.checkFailed")));
      },
    },
  });
  const run = usePostApiMeImportSteam({
    mutation: {
      onSuccess: (result) => {
        refresh();
        toast.success(
          t("toast.imported", {
            imported: result.imported,
            skipped: result.skipped,
            errors: result.errors,
          }),
        );
        setPreview(null);
        setChanging(false);
        setProfile("");
        onImported?.();
      },
      onError: (error) => toast.error(apiMessage(error, t("toast.importFailed"))),
    },
  });
  const unlink = useDeleteApiMeSteam({
    mutation: {
      onSuccess: () => {
        refresh();
        setPreview(null);
        toast.success(t("steam.unlinked"));
      },
    },
  });

  return (
    <div className="space-y-4">
      {linked ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-48 flex-1 basis-full text-sm sm:basis-auto">
            <div className="font-semibold">{t("steam.linked")}</div>
            <div className="num truncate text-xs text-dimmed">
              {steamId}
              {steamSyncedAt && ` · ${t("steam.syncedAgo", { when: relativeDate(steamSyncedAt) })}`}
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => check.mutate({ data: body() })}
            disabled={check.isPending}
          >
            {check.isPending ? t("steam.checking") : t("steam.checkNew")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setChanging(true)}>
            {t("steam.change")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-dimmed hover:text-destructive"
            onClick={() => unlink.mutate()}
            disabled={unlink.isPending}
          >
            {t("steam.unlink")}
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (profile.trim()) check.mutate({ data: body() });
          }}
          className="flex flex-wrap gap-2"
        >
          <Input
            value={profile}
            onChange={(e) => {
              setProfile(e.target.value);
              setPreview(null);
            }}
            placeholder={t("steam.placeholder")}
            aria-label={t("steam.placeholder")}
            className="min-w-0 flex-1 basis-64"
          />
          <Button type="submit" variant="secondary" disabled={check.isPending || !profile.trim()}>
            {check.isPending ? t("steam.checking") : t("steam.check")}
          </Button>
        </form>
      )}

      {preview && (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-[15px]">
            <Trans
              i18nKey="steam.summary"
              values={{ owned: preview.owned, hours: preview.hoursPlayed }}
              components={{ n: <b className="num" /> }}
            />{" "}
            {preview.neverPlayed > 0 && (
              <Trans
                i18nKey="steam.neverLaunched"
                count={preview.neverPlayed}
                values={{ count: preview.neverPlayed }}
                components={{ bad: <b className="num text-signal" /> }}
              />
            )}
          </p>
          <ul className="grid gap-1 text-sm text-dimmed sm:grid-cols-2">
            <li>{t("steam.toImport", { count: preview.toImport })}</li>
            <li>{t("steam.already", { count: preview.alreadyInLibrary })}</li>
            <li>{t("steam.unmatched", { count: preview.unmatched })}</li>
          </ul>
          {preview.mostPlayed.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="eyebrow self-center">{t("steam.mostPlayed")}</span>
              {preview.mostPlayed.map((g) => (
                <Link
                  key={g.gameId}
                  to="/games/$id"
                  params={{ id: String(g.gameId) }}
                  className="border border-border px-2 py-1 hover:border-foreground/40"
                >
                  {g.name}{" "}
                  <span className="num text-dimmed">{t("steam.hours", { count: g.hours })}</span>
                </Link>
              ))}
            </div>
          )}
          {preview.toImport > 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              {preview.played > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="steam-played">
                    {t("steam.playedAs", { count: preview.played })}
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
                onClick={() => run.mutate({ data: { ...body(), playedStatus } })}
                disabled={run.isPending}
              >
                {run.isPending
                  ? t("steam.importing")
                  : t("steam.import", { count: preview.toImport })}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-dimmed">{t("steam.nothingNew")}</p>
          )}
        </div>
      )}
    </div>
  );
}
