import type { PublicUserResponse, UserGameWithUserData } from "@playdamnit/api-client";
import { Link } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { useMemo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ratingColor } from "@/lib/format";

interface ProfileHeaderProps {
  user: PublicUserResponse;
  entries: UserGameWithUserData[];
  isOwn: boolean;
}

const thisYear = new Date().getFullYear();

/** Avatar, names and the headline numbers (games played, played this year, backlog, ratings) */
export function ProfileHeader({ user, entries, isOwn }: ProfileHeaderProps) {
  const stats = useMemo(() => {
    let played = 0;
    let playedThisYear = 0;
    let backlog = 0;
    const buckets = Array.from({ length: 10 }, () => 0);
    let rated = 0;
    let sum = 0;
    for (const entry of entries) {
      const { status, rating, endedAt } = entry.userGameData;
      if (
        status === "finished" ||
        status === "dropped" ||
        status === "playing" ||
        status === "online"
      )
        played++;
      if (endedAt && new Date(endedAt).getFullYear() === thisYear) playedThisYear++;
      if (status === "backlog" || status === "want_to_play") backlog++;
      if (rating) {
        rated++;
        sum += rating;
        buckets[Math.min(9, Math.max(0, Math.ceil(rating) - 1))]++;
      }
    }
    const max = Math.max(1, ...buckets);
    return {
      played,
      playedThisYear,
      backlog,
      rated,
      average: rated ? sum / rated : 0,
      buckets,
      max,
    };
  }, [entries]);

  const initial = (user.username || user.name || "?").slice(0, 1).toUpperCase();

  return (
    <header className="panel p-5 sm:p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-4">
          <Avatar className="size-20 border border-white/30">
            <AvatarImage src={user.image || undefined} alt={user.name} />
            <AvatarFallback className="bg-[#1c1f21] text-3xl font-semibold">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{user.name || user.username}</h1>
            <div className="truncate text-sm text-dimmed">@{user.username}</div>
            {isOwn && (
              <Button asChild variant="outline" size="xs" className="mt-2">
                <Link to="/$username/settings" params={{ username: user.username }}>
                  <SettingsIcon /> Edit profile
                </Link>
              </Button>
            )}
          </div>
        </div>

        <dl className="grid flex-1 grid-cols-3 gap-4 sm:ml-auto sm:max-w-md">
          <Stat label="Games played" value={stats.played} />
          <Stat label={`Played in ${thisYear}`} value={stats.playedThisYear} />
          <Stat label="Backlog" value={stats.backlog} />
        </dl>
      </div>

      {stats.rated > 0 && (
        <div className="mt-6 flex items-end gap-4">
          <div className="shrink-0">
            <div className="text-xs text-dimmed">Average</div>
            <div className={`text-2xl font-bold tabular-nums ${ratingColor(stats.average)}`}>
              {stats.average.toFixed(1)}
            </div>
          </div>
          <div className="flex h-12 flex-1 items-end gap-1" aria-label="Rating distribution">
            {stats.buckets.map((count, i) => (
              <div
                key={i}
                title={`${i + 1}: ${count}`}
                className="flex-1 rounded-sm bg-white/15 transition-colors hover:bg-white/30"
                style={{ height: `${Math.max(8, (count / stats.max) * 100)}%` }}
              />
            ))}
          </div>
          <div className="shrink-0 text-xs text-dimmed">{stats.rated} rated</div>
        </div>
      )}
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-dimmed">{label}</dt>
      <dd className="text-3xl font-bold tabular-nums">{String(value).padStart(3, "0")}</dd>
    </div>
  );
}
