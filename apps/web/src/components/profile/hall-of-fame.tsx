import { useGetApiUserByUsernameOverview } from "@playdamnit/api-client";
import { useTranslation } from "react-i18next";

import { igdbImage, igdbSrcSet } from "@/lib/image";
import { IgdbSize, ImageLoading } from "@/lib/enums";

const SHELF = 14;

/**
 * A dimmed shelf of covers across the top of the profile header, as the API ranks them (the
 * best graded first). A small library repeats so the shelf is always full.
 */
export function HallOfFame({ username }: { username: string }) {
  const { t } = useTranslation();
  const overview = useGetApiUserByUsernameOverview(username);
  const ranked = overview.data?.shelf ?? [];
  const shelf = ranked.length
    ? Array.from({ length: SHELF }, (_, i) => ranked[i % ranked.length])
    : [];
  return (
    <div className="relative h-28 overflow-hidden bg-card sm:h-36" aria-hidden>
      <div className="flex h-full">
        {shelf.map((e, i) => (
          <img
            key={`${e.id}-${i}`}
            src={igdbImage(e.cover, IgdbSize.CoverBig) ?? undefined}
            srcSet={igdbSrcSet(e.cover, IgdbSize.CoverBig)}
            alt=""
            loading={ImageLoading.Lazy}
            className="h-full w-auto shrink-0 object-cover opacity-45 saturate-[.6]"
          />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      {shelf.length > 0 && (
        <span className="eyebrow absolute top-3 right-4 text-foreground/70">
          {overview.data?.hallOfFame ? t("profile.hallOfFame") : t("profile.shelf")}
        </span>
      )}
    </div>
  );
}
