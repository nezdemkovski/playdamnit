import type { UserGameWithUserData } from "@playdamnit/api-client";

import { t } from "@/i18n";

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
    if (d.status === "finished") finished++;
    if (d.status === "playing") playing++;
    if (d.status === "dropped") dropped++;
    if (d.status === "backlog" || d.status === "want_to_play") backlog++;
    if (d.addedAt && now - new Date(d.addedAt).getTime() < 7 * DAY) addedThisWeek++;
    if (d.status === "finished" && d.endedAt && now - new Date(d.endedAt).getTime() < 30 * DAY)
      finishedThisMonth++;
    if (
      (d.status === "backlog" || d.status === "want_to_play") &&
      (!longestIdle || idleDays(e) > idleDays(longestIdle))
    )
      longestIdle = e;
    if (d.status === "playing" && (!stalePlaying || idleDays(e) > idleDays(stalePlaying)))
      stalePlaying = e;
  }
  const settled =
    entries.length - entries.filter((e) => e.userGameData.status === "want_to_play").length;
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

export const addedLine = (s: LibrarySummary): string =>
  s.addedThisWeek > 0 ? t("voice.added.some", { count: s.addedThisWeek }) : t("voice.added.none");

export const finishedLine = (entries: UserGameWithUserData[]): string => {
  const last = entries
    .filter((e) => e.userGameData.status === "finished" && e.userGameData.endedAt)
    .sort((a, b) => (b.userGameData.endedAt ?? "").localeCompare(a.userGameData.endedAt ?? ""))[0];
  if (!last) return t("voice.finished.never");
  const d = daysSince(last.userGameData.endedAt);
  if (d < 7) return t("voice.finished.thisWeek");
  return d < 45 ? t("voice.finished.recent", { count: d }) : t("voice.finished.old", { count: d });
};

export const playingLine = (s: LibrarySummary): string => {
  if (!s.stalePlaying) return t("voice.playing.none");
  const d = idleDays(s.stalePlaying);
  return d > 30 ? t("voice.playing.stale", { count: d }) : t("voice.playing.fine");
};

export const backlogLine = (s: LibrarySummary): string => {
  const hours = s.backlog * 46; // IGDB's median "normally" across the catalog, give or take
  if (s.backlog === 0) return t("voice.backlog.empty");
  return hours > 1000
    ? t("voice.backlog.huge", { hours: Math.round(hours / 100) * 100 })
    : t("voice.backlog.ok", { hours });
};

export const idleLine = (entry: UserGameWithUserData): string => {
  const d = idleDays(entry);
  const status = entry.userGameData.status;
  if (status === "finished") return t("voice.idle.finished");
  if (status === "dropped") return t("voice.idle.dropped");
  if (status === "playing")
    return d > 30 ? t("voice.idle.playingStale", { count: d }) : t("voice.idle.playingFine");
  if (status === "on_hold") return t("voice.idle.onHold", { count: d });
  if (status === "online") return t("voice.idle.online");
  return d === 0 ? t("voice.idle.today") : t("voice.idle.never", { count: d });
};

/** Toasts after a library write */
export const toastFor = (
  kind: "add" | "update" | "remove",
  status: string | undefined,
  s: LibrarySummary,
): string => {
  if (kind === "remove") return t("voice.toast.removed");
  if (status === "finished") return t("voice.toast.finished", { count: s.backlog });
  if (status === "dropped") return t("voice.toast.dropped");
  if (kind === "add") return t("voice.toast.added", { count: s.total + 1 });
  return t("voice.toast.saved");
};
