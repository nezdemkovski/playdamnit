import { randomBytes } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { cover, game } from "@playdamnit/db/schema";
import type { Grade } from "@/utils/enums";
import { GRADE_BANDS, gradeIndexSql } from "@/utils/grade";
import { getImageUrl, IgdbImageSize } from "@/utils/image";

// A game people know: rated by enough IGDB players, or flagged popular
const MIN_RATINGS = 40;
// Games each page takes from every tier; a page deals them all
const PER_TIER = 20;
// The ends of the scale come up a little less often than the middle, one weight per grade band
const TIER_WEIGHTS = GRADE_BANDS.map((_, i) => (i === 0 || i === GRADE_BANDS.length - 1 ? 0.7 : 1));

export interface ShowcaseGame {
  id: number;
  cover: string;
  /** The catalog's score, 0–100 */
  score: number;
  /** The score's grade */
  grade: Grade;
}

export interface ShowcasePage {
  games: ShowcaseGame[];
  /** Keeps the order of the next pages; pass it back with `nextPage` */
  seed: string;
  /** null once every game has been dealt */
  nextPage: number | null;
}

/**
 * Well-known games with real scores for the app's welcome screen, dealt so the whole S-to-F
 * scale shows: each next game draws a tier at random (weighted near even), then a game from it.
 * Pages go on without repeats for one seed (each tier in a fixed pseudo-random order); a new seed
 * is a new order.
 */
export const showcase = async (
  seed: string = randomBytes(6).toString("hex"),
  page = 0,
): Promise<ShowcasePage> => {
  // The grade band of the score, S first
  const tier = gradeIndexSql(sql`${game.totalRating} / 10`);
  const { rows } = await db.execute<{
    id: number;
    hash: string;
    source: string;
    score: number;
    tier: number;
    pick: number;
  }>(sql`
    select id, hash, source, score, tier, pick from (
      select ${game.id} as id, ${cover.hash} as hash, ${cover.source} as source,
        ${game.totalRating} as score, ${tier} as tier,
        row_number() over (partition by ${tier} order by md5(${seed} || ${game.id}::text)) as pick
      from ${game}
      join ${cover} on ${cover.gameId} = ${game.id}
      where ${game.deletedAt} is null
        and ${game.versionParentId} is null
        and ${game.totalRating} > 0
        and (${game.totalRatingCount} >= ${MIN_RATINGS} or ${game.isPopular})
    ) sampled
    where pick > ${page * PER_TIER} and pick <= ${(page + 1) * PER_TIER + 1}
  `);

  const tiers = GRADE_BANDS.map(() => [] as ShowcaseGame[]);
  // One row past the page in a tier says there is more after it
  const more = rows.some((r) => Number(r.pick) > (page + 1) * PER_TIER);
  for (const r of rows) {
    if (Number(r.pick) > (page + 1) * PER_TIER) continue;
    tiers[Number(r.tier)]?.push({
      id: Number(r.id),
      cover: getImageUrl(r.source, r.hash, IgdbImageSize.COVER_BIG),
      score: Number(r.score),
      grade: GRADE_BANDS[Number(r.tier)].grade,
    });
  }
  const dealt: ShowcaseGame[] = [];
  for (;;) {
    const open = tiers.flatMap((list, i) => (list.length ? [i] : []));
    if (!open.length) break;
    const total = open.reduce((sum, i) => sum + TIER_WEIGHTS[i], 0);
    let roll = Math.random() * total;
    const pick = open.find((i) => (roll -= TIER_WEIGHTS[i]) < 0) ?? open[0];
    dealt.push(tiers[pick].pop()!);
  }
  return { games: dealt, seed, nextPage: more ? page + 1 : null };
};
