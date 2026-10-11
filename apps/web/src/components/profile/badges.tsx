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

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

/** Badges as a row of small tiles for the profile header: earned ones lit, the rest dim */
export function BadgeStrip({ badges }: { badges: Badge[] }) {
  const earned = badges.filter((b) => b.earned).length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {[...badges]
        .sort((a, b) => Number(b.earned) - Number(a.earned))
        .map((badge) => (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "flex size-7 items-center justify-center border",
                  badge.earned
                    ? "border-warning/50 bg-warning/15 text-warning"
                    : "border-border text-dimmed/40",
                )}
              >
                <badge.icon className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-semibold">{badge.label}</span>
              <span className="block text-dimmed">{badge.description}</span>
            </TooltipContent>
          </Tooltip>
        ))}
      <span className="eyebrow ml-1">
        {earned} / {badges.length}
      </span>
    </div>
  );
}
