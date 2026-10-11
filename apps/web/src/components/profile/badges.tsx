import { StatusEnum, type UserGameWithUserData } from "@playdamnit/api-client";
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

import { t } from "@/i18n";
import { BadgeId } from "@/lib/enums";

interface Badge {
  id: BadgeId;
  label: string;
  description: string;
  icon: LucideIcon;
  earned: boolean;
}

/** Badges computed from the library (no server state) */
export const computeBadges = (entries: UserGameWithUserData[], reviews: number): Badge[] => {
  const finished = entries.filter((e) => e.userGameData.status === StatusEnum.Finished).length;
  const rated = entries.filter((e) => e.userGameData.rating).length;
  const mastered = entries.filter((e) => e.userGameData.mastered).length;
  const year = new Date().getFullYear();
  const thisYear = entries.filter(
    (e) => e.userGameData.endedAt && new Date(e.userGameData.endedAt).getFullYear() === year,
  ).length;
  const make = (id: Exclude<BadgeId, BadgeId.Year>, icon: LucideIcon, earned: boolean): Badge => ({
    id,
    label: t(`badges.${id}.label`),
    description: t(`badges.${id}.description`),
    icon,
    earned,
  });
  return [
    make(BadgeId.First, Gamepad2Icon, entries.length >= 1),
    make(BadgeId.Collector, BookOpenIcon, entries.length >= 50),
    make(BadgeId.Hoarder, SparklesIcon, entries.length >= 200),
    make(BadgeId.Finisher, FlagIcon, finished >= 10),
    make(BadgeId.Closer, AwardIcon, finished >= 50),
    make(BadgeId.Critic, StarIcon, rated >= 25),
    make(BadgeId.Writer, PenLineIcon, reviews >= 10),
    make(BadgeId.Completionist, TrophyIcon, mastered >= 5),
    {
      id: BadgeId.Year,
      label: t("badges.year.label", { year }),
      description: t("badges.year.description", { year }),
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
