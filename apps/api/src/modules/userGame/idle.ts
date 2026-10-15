import { UserGameStatus } from "@playdamnit/db/enums";
import { IdleKind } from "@/utils/enums";

const DAY_MS = 86_400_000;
/** "Playing" for longer than this without a touch reads as stale */
const STALE_PLAYING_DAYS = 30;

interface IdleInput {
  status: UserGameStatus;
  addedAt: Date | null;
  updatedAt: Date | null;
  steamLastPlayedAt: Date | null;
}

/**
 * How long an entry has sat untouched and which line says so. Steam's last launch is the truth
 * when there is one, otherwise the last edit here, otherwise the add.
 */
export const idleOf = (entry: IdleInput, now = Date.now()) => {
  const touched = entry.steamLastPlayedAt ?? entry.updatedAt ?? entry.addedAt;
  const days = touched ? Math.max(0, Math.floor((now - touched.getTime()) / DAY_MS)) : 0;
  const kind = ((): IdleKind => {
    switch (entry.status) {
      case UserGameStatus.Finished:
        return IdleKind.Finished;
      case UserGameStatus.Dropped:
        return IdleKind.Dropped;
      case UserGameStatus.Playing:
        return days > STALE_PLAYING_DAYS ? IdleKind.PlayingStale : IdleKind.PlayingFine;
      case UserGameStatus.OnHold:
        return IdleKind.OnHold;
      case UserGameStatus.Online:
        return IdleKind.Online;
      case UserGameStatus.WantToPlay:
        return days === 0 ? IdleKind.Today : IdleKind.Wanted;
      case UserGameStatus.Backlog:
        return days === 0 ? IdleKind.Today : IdleKind.Untouched;
    }
  })();
  return { kind, days };
};
