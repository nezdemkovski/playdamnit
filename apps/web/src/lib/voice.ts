import type { UserGameWithUserData } from "@playdamnit/api-client";

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
  if (s.total === 0) return "Nothing here. Nothing to feel guilty about. Enjoy it while it lasts.";
  if (s.finishedThisMonth >= 3)
    return `${s.finishedThisMonth} finished this month. Who are you and what did you do with the backlog?`;
  if (s.completion >= 50) return "More than half done. We're almost proud.";
  if (s.finished === 0) return "We're not mad. Just disappointed.";
  return "We're not mad. Just disappointed. Your backlog is bigger than your Steam library.";
};

export const addedLine = (s: LibrarySummary): string =>
  s.addedThisWeek > 0
    ? `+${s.addedThisWeek} this week. Stop.`
    : "Nothing new this week. Suspicious.";

export const finishedLine = (entries: UserGameWithUserData[]): string => {
  const last = entries
    .filter((e) => e.userGameData.status === "finished" && e.userGameData.endedAt)
    .sort((a, b) => (b.userGameData.endedAt ?? "").localeCompare(a.userGameData.endedAt ?? ""))[0];
  if (!last) return "Never. We're counting.";
  const d = daysSince(last.userGameData.endedAt);
  return d < 7
    ? "This week. Noted."
    : d < 45
      ? `${d} days ago. Acceptable.`
      : `${d} days ago. We remember.`;
};

export const playingLine = (s: LibrarySummary): string => {
  if (!s.stalePlaying) return "Nothing. At least you're honest.";
  const d = idleDays(s.stalePlaying);
  return d > 30 ? `One for ${d} days. Playing is a strong word.` : "Keep going.";
};

export const backlogLine = (s: LibrarySummary): string => {
  const hours = s.backlog * 46; // IGDB's median "normally" across the catalog, give or take
  if (s.backlog === 0) return "Empty. Either discipline or denial.";
  return hours > 1000
    ? `≈ ${Math.round(hours / 100) * 100} hours. A year of evenings.`
    : `≈ ${hours} hours. Doable, allegedly.`;
};

export const idleLine = (entry: UserGameWithUserData): string => {
  const d = idleDays(entry);
  const status = entry.userGameData.status;
  if (status === "finished") return "cleared";
  if (status === "dropped") return "honest at least";
  if (status === "playing") return d > 30 ? `${d} days as "playing"` : "in progress";
  if (status === "on_hold") return `${d} days on hold`;
  if (status === "online") return "no ending, no guilt";
  return d === 0 ? "added today" : `${d} days, never opened`;
};

/** Toasts after a library write */
export const toastFor = (
  kind: "add" | "update" | "remove",
  status: string | undefined,
  s: LibrarySummary,
): string => {
  if (kind === "remove") return "Removed. The backlog breathes a little easier.";
  if (status === "finished") return `Finished. ${s.backlog} to go. We noticed.`;
  if (status === "dropped") return "Dropped. Bold. Honest. We respect it.";
  if (kind === "add") return `Added. That's ${s.total + 1} now. Just saying.`;
  return "Saved. The numbers have been updated accordingly.";
};
