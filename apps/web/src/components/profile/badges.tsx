import { BadgeId, type ProfileBadge } from "@playdamnit/api-client";
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

interface Badge {
  id: BadgeId;
  label: string;
  description: string;
  icon: LucideIcon;
  earned: boolean;
}

const ICONS: Record<BadgeId, LucideIcon> = {
  [BadgeId.First]: Gamepad2Icon,
  [BadgeId.Collector]: BookOpenIcon,
  [BadgeId.Hoarder]: SparklesIcon,
  [BadgeId.Finisher]: FlagIcon,
  [BadgeId.Closer]: AwardIcon,
  [BadgeId.Critic]: StarIcon,
  [BadgeId.Writer]: PenLineIcon,
  [BadgeId.Completionist]: TrophyIcon,
  [BadgeId.Year]: FlagIcon,
};

/** The API's badges with their icon and text; `year` is the one the year badge counts */
export const describeBadges = (badges: ProfileBadge[], year: number): Badge[] =>
  badges.map(({ id, earned }) => ({
    id,
    earned,
    icon: ICONS[id],
    label: id === BadgeId.Year ? t("badges.year.label", { year }) : t(`badges.${id}.label`),
    description:
      id === BadgeId.Year ? t("badges.year.description", { year }) : t(`badges.${id}.description`),
  }));

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
