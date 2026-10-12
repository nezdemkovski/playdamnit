import type { LibraryIndexItem } from "@playdamnit/api-client";
import { useTranslation } from "react-i18next";

import { igdbImage } from "@/lib/image";
import { Grade, IgdbSize, ImageLoading } from "@/lib/enums";
import { gradeOf } from "@/lib/grade";

const SHELF = 14;

/**
 * The covers that define a player, best first: the S tier, then the rest by grade, then the
 * ungraded by when they were added. A small library repeats so the shelf is always full.
 */
export const hallOfFame = (entries: LibraryIndexItem[]): LibraryIndexItem[] => {
  const withCover = entries.filter((e) => e.cover);
  if (!withCover.length) return [];
  const ranked = [...withCover].sort(
    (a, b) =>
      (b.userGameData.rating ?? 0) - (a.userGameData.rating ?? 0) ||
      (b.userGameData.addedAt ?? "").localeCompare(a.userGameData.addedAt ?? ""),
  );
  return Array.from({ length: SHELF }, (_, i) => ranked[i % ranked.length]);
};

/** A dimmed shelf of covers across the top of the profile header */
export function HallOfFame({ entries }: { entries: LibraryIndexItem[] }) {
  const { t } = useTranslation();
  const shelf = hallOfFame(entries);
  const isS = shelf.length > 0 && gradeOf(shelf[0].userGameData.rating) === Grade.S;
  return (
    <div className="relative h-28 overflow-hidden bg-card sm:h-36" aria-hidden>
      <div className="flex h-full">
        {shelf.map((e, i) => (
          <img
            key={`${e.id}-${i}`}
            src={igdbImage(e.cover, IgdbSize.CoverBig) ?? undefined}
            alt=""
            loading={ImageLoading.Lazy}
            className="h-full w-auto shrink-0 object-cover opacity-45 saturate-[.6]"
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      {shelf.length > 0 && (
        <span className="eyebrow absolute top-3 right-4 text-foreground/70">
          {isS ? t("profile.hallOfFame") : t("profile.shelf")}
        </span>
      )}
    </div>
  );
}
