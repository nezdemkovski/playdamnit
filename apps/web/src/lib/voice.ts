import { StatusEnum, type UserGameWithUserData } from "@playdamnit/api-client";

import { t } from "@/i18n";
import { LibraryAction } from "@/lib/enums";

/**
 * The site's voice: one-liners that only make sense next to the user's real numbers. Sarcasm
 * aims at the backlog, never at the person; praise exists and is rare.
 */

const DAY = 86_400_000;

export const daysSince = (iso: string | null | undefined): number =>
  iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY)) : 0;

/** Days an entry has sat untouched (status change or add) */
export const idleDays = (entry: UserGameWithUserData): number =>
  daysSince(entry.userGameData.updatedAt ?? entry.userGameData.addedAt);

export interface LibrarySummary {
  total: number;
  finished: number;
  playing: number;
  dropped: number;
  backlog: number;
  addedThisWeek: number;
  finishedThisMonth: number;
  /** Finished + dropped over everything that is not "want" */
  completion: number;
  longestIdle: UserGameWithUserData | null;
  stalePlaying: UserGameWithUserData | null;
}

export const summarize = (entries: UserGameWithUserData[]): LibrarySummary => {
  const now = Date.now();
  let finished = 0;
  let playing = 0;
  let dropped = 0;
  let backlog = 0;
  let addedThisWeek = 0;
  let finishedThisMonth = 0;
  let longestIdle: UserGameWithUserData | null = null;
  let stalePlaying: UserGameWithUserData | null = null;
  for (const e of entries) {
    const d = e.userGameData;
    if (d.status === StatusEnum.Finished) finished++;
    if (d.status === StatusEnum.Playing) playing++;
    if (d.status === StatusEnum.Dropped) dropped++;
    if (d.status === StatusEnum.Backlog || d.status === StatusEnum.WantToPlay) backlog++;
    if (d.addedAt && now - new Date(d.addedAt).getTime() < 7 * DAY) addedThisWeek++;
    if (
      d.status === StatusEnum.Finished &&
      d.endedAt &&
      now - new Date(d.endedAt).getTime() < 30 * DAY
    )
      finishedThisMonth++;
    if (
      (d.status === StatusEnum.Backlog || d.status === StatusEnum.WantToPlay) &&
      (!longestIdle || idleDays(e) > idleDays(longestIdle))
    )
      longestIdle = e;
    if (d.status === StatusEnum.Playing && (!stalePlaying || idleDays(e) > idleDays(stalePlaying)))
      stalePlaying = e;
  }
  const settled =
    entries.length - entries.filter((e) => e.userGameData.status === StatusEnum.WantToPlay).length;
  return {
    total: entries.length,
    finished,
    playing,
    dropped,
    backlog,
    addedThisWeek,
    finishedThisMonth,
    completion: settled ? (finished / settled) * 100 : 0,
    longestIdle,
    stalePlaying,
  };
};

export const verdictLine = (s: LibrarySummary): string => {
  if (s.total === 0) return t("voice.verdict.empty");
  if (s.finishedThisMonth >= 3) return t("voice.verdict.streak", { count: s.finishedThisMonth });
  if (s.completion >= 50) return t("voice.verdict.halfDone");
  if (s.finished === 0) return t("voice.verdict.none");
  return t("voice.verdict.default");
};

/** The owner's line under the profile's finished bar: when they last finished anything */
export const lastFinishLine = (entries: UserGameWithUserData[]): string => {
  const last = entries
    .filter((e) => e.userGameData.status === StatusEnum.Finished && e.userGameData.endedAt)
    .sort((a, b) => (b.userGameData.endedAt ?? "").localeCompare(a.userGameData.endedAt ?? ""))[0];
  if (!last) return t("voice.lastFinish.never");
  const d = daysSince(last.userGameData.endedAt);
  if (d < 7) return t("voice.lastFinish.thisWeek");
  return d < 45
    ? t("voice.lastFinish.recent", { count: d })
    : t("voice.lastFinish.old", { count: d });
};

export const idleLine = (entry: UserGameWithUserData): string => {
  const d = idleDays(entry);
  const status = entry.userGameData.status;
  if (status === StatusEnum.Finished) return t("voice.idle.finished");
  if (status === StatusEnum.Dropped) return t("voice.idle.dropped");
  if (status === StatusEnum.Playing)
    return d > 30 ? t("voice.idle.playingStale", { count: d }) : t("voice.idle.playingFine");
  if (status === StatusEnum.OnHold) return t("voice.idle.onHold", { count: d });
  if (status === StatusEnum.Online) return t("voice.idle.online");
  return d === 0 ? t("voice.idle.today") : t("voice.idle.never", { count: d });
};

/** Toasts after a library write */
export const toastFor = (
  kind: LibraryAction,
  status: string | undefined,
  s: LibrarySummary,
): string => {
  if (kind === LibraryAction.Remove) return t("voice.toast.removed");
  if (status === StatusEnum.Finished) return t("voice.toast.finished", { count: s.backlog });
  if (status === StatusEnum.Dropped) return t("voice.toast.dropped");
  if (kind === LibraryAction.Add) return t("voice.toast.added", { count: s.total + 1 });
  return t("voice.toast.saved");
};
