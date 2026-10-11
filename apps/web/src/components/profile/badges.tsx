import type { UserGameWithUserData } from "@playdamnit/api-client";
import {
  AwardIcon,
  BookOpenIcon,
  FlagIcon,
  Gamepad2Icon,
  PenLineIcon,
  SparklesIcon,
  StarIcon,
  TrophyIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";

interface Badge {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  earned: boolean;
}

/** Badges computed from the library (no server state) */
export const computeBadges = (entries: UserGameWithUserData[], reviews: number): Badge[] => {
  const finished = entries.filter((e) => e.userGameData.status === "finished").length;
  const rated = entries.filter((e) => e.userGameData.rating).length;
  const mastered = entries.filter((e) => e.userGameData.mastered).length;
  const year = new Date().getFullYear();
  const thisYear = entries.filter(
    (e) => e.userGameData.endedAt && new Date(e.userGameData.endedAt).getFullYear() === year,
  ).length;
  return [
    {
      id: "first",
      label: "First log",
      description: "Added a game to the list",
      icon: Gamepad2Icon,
      earned: entries.length >= 1,
    },
    {
      id: "collector",
      label: "Collector",
      description: "50 games in the list",
      icon: BookOpenIcon,
      earned: entries.length >= 50,
    },
    {
      id: "hoarder",
      label: "Hoarder",
      description: "200 games in the list",
      icon: SparklesIcon,
      earned: entries.length >= 200,
    },
    {
      id: "finisher",
      label: "Finisher",
      description: "Finished 10 games",
      icon: FlagIcon,
      earned: finished >= 10,
    },
    {
      id: "closer",
      label: "Closer",
      description: "Finished 50 games",
      icon: AwardIcon,
      earned: finished >= 50,
    },
    {
      id: "critic",
      label: "Critic",
      description: "Rated 25 games",
      icon: StarIcon,
      earned: rated >= 25,
    },
    {
      id: "writer",
      label: "Writer",
      description: "Wrote 10 reviews",
      icon: PenLineIcon,
      earned: reviews >= 10,
    },
    {
      id: "completionist",
      label: "Completionist",
      description: "Mastered 5 games",
      icon: TrophyIcon,
      earned: mastered >= 5,
    },
    {
      id: "year",
      label: `${year} grind`,
      description: `Finished 12 games in ${year}`,
      icon: FlagIcon,
      earned: thisYear >= 12,
    },
  ];
};

export function Badges({ badges }: { badges: Badge[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {badges.map((badge) => (
        <div
          key={badge.id}
          title={badge.description}
          className={cn(
            "flex flex-col items-center gap-1 rounded-xl border p-3 text-center",
            badge.earned
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-white/5 text-dimmed/50",
          )}
        >
          <badge.icon className="size-5" />
          <span className="text-xs font-semibold">{badge.label}</span>
        </div>
      ))}
    </div>
  );
}
