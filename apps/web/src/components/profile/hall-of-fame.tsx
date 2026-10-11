import type { UserGameWithUserData } from "@playdamnit/api-client";
import { useTranslation } from "react-i18next";

import { igdbImage } from "@/lib/image";
import { Grade, IgdbSize, ImageLoading } from "@/lib/enums";
import { gradeOf } from "@/lib/grade";

const SHELF = 14;

/**
 * The covers that define a player, best first: the S tier, then the rest by grade, then the
 * ungraded by when they were added. A small library repeats so the shelf is always full.
 */
export const hallOfFame = (entries: UserGameWithUserData[]): UserGameWithUserData[] => {
  const withCover = entries.filter((e) => e.cover?.url);
  if (!withCover.length) return [];
  const ranked = [...withCover].sort(
    (a, b) =>
      (b.userGameData.rating ?? 0) - (a.userGameData.rating ?? 0) ||
      (b.userGameData.addedAt ?? "").localeCompare(a.userGameData.addedAt ?? ""),
  );
  return Array.from({ length: SHELF }, (_, i) => ranked[i % ranked.length]);
};

/** A tilted wall of the player's covers across the top of the profile header */
export function HallOfFame({ entries }: { entries: UserGameWithUserData[] }) {
  const { t } = useTranslation();
  const shelf = hallOfFame(entries);
  const isS = shelf.length > 0 && gradeOf(shelf[0].userGameData.rating) === Grade.S;
  const rows = [shelf, [...shelf.slice(SHELF / 2), ...shelf.slice(0, SHELF / 2)]];
  return (
    <div className="relative h-36 overflow-hidden bg-card sm:h-44" aria-hidden>
      {shelf.length > 0 && (
        <div className="absolute -top-16 -left-10 flex w-[160%] -rotate-[7deg] flex-col gap-2 opacity-50 saturate-[.65] transition-opacity duration-500 group-hover/header:opacity-70">
          {rows.map((row, r) => (
            <div key={r} className={r ? "flex gap-2 pl-12" : "flex gap-2"}>
              {row.map((e, i) => (
                <img
                  key={`${e.id}-${i}`}
                  src={igdbImage(e.cover?.url, IgdbSize.CoverBig) ?? undefined}
                  alt=""
                  loading={ImageLoading.Lazy}
                  className="aspect-[3/4] w-24 shrink-0 object-cover sm:w-28"
                />
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/10" />
      {shelf.length > 0 && (
        <span className="eyebrow absolute top-3 right-4 text-foreground/80">
          {isS ? t("profile.hallOfFame") : t("profile.shelf")}
        </span>
      )}
    </div>
  );
}
