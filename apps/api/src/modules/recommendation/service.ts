import { sql } from "drizzle-orm";
import { cover, game, gameLike, gameToCollection, userGames } from "@playdamnit/db/schema";
import { UserGameStatus } from "@playdamnit/db/enums";

import { db } from "@/db/postgres";
import { GameService } from "@/modules/game/service";
import { RecommendableGameType } from "@/utils/enums";

export const MAX_RECOMMENDATIONS = 40;
const RECOMMENDABLE_TYPES = Object.values(RecommendableGameType).filter(
  (v): v is number => typeof v === "number",
);

// What an entry says about taste: grades speak loudest, a low grade pushes its neighbours
// away, a status without a grade is a weak hint
const GRADE_WEIGHT = sql`case
  when ${userGames.rating} >= 9 then 4
  when ${userGames.rating} >= 8 then 3
  when ${userGames.rating} >= 7 then 1.5
  when ${userGames.rating} >= 6 then 0.5
  else -2 end`;
const STATUS_WEIGHT = sql`case ${userGames.status}
  when ${UserGameStatus.Finished} then 1.5
  when ${UserGameStatus.Playing} then 1
  when ${UserGameStatus.OnHold} then 0.5
  when ${UserGameStatus.Dropped} then -1
  else 0.3 end`;
// Steam hours count on a log scale, capped: 10 h ≈ 1.2, 50 h and up = 2
const HOURS_WEIGHT = sql`coalesce(least(2, ln(1 + ${userGames.steamMinutes} / 60.0) / 2), 0)`;
const LIKE_WEIGHT = 1.5;
// A series fills at most this many places, or one loved game turns the list into its sequels
const PER_SERIES = 2;

export class RecommendationService {
  /**
   * Games for a user to play next: IGDB's similar games of everything in their library,
   * weighted by how much they liked each source game (grade, status, Steam hours, likes) and
   * by its place in the similar list, then nudged by rating and popularity. Released whole
   * games with a cover only; nothing already in the library, editions of it included.
   */
  static async forUser(userId: string, limit: number) {
    const now = Math.floor(Date.now() / 1000);
    const rows = await db.execute<{ id: number }>(sql`
      with seed_weights as (
        select ${userGames.gameId} as game_id,
          (case when ${userGames.rating} > 0 then ${GRADE_WEIGHT} else ${STATUS_WEIGHT} end)
            + ${HOURS_WEIGHT} as w
        from ${userGames}
        where ${userGames.userId} = ${userId}
        union all
        select ${gameLike.gameId}, ${LIKE_WEIGHT} from ${gameLike} where ${gameLike.userId} = ${userId}
      ),
      seeds as (
        select game_id, sum(w) as w from seed_weights group by game_id having sum(w) <> 0
      ),
      candidates as (
        select s.id, sum(seeds.w / sqrt(s.ord)) as score
        from seeds
        join ${game} on ${game.id} = seeds.game_id
        cross join lateral unnest(${game.similarGameIds}) with ordinality as s(id, ord)
        group by s.id
      ),
      ranked as (
        select c.id,
          c.score * (0.6 + coalesce(${game.totalRating}, 60) / 250)
            + ln(1 + coalesce(${game.totalRatingCount}, 0)) * 0.05 as rank,
          (select min(${gameToCollection.collectionId}) from ${gameToCollection}
            where ${gameToCollection.gameId} = c.id) as series
        from candidates c
        join ${game} on ${game.id} = c.id
        where c.score > 0
          and ${game.deletedAt} is null
          and ${game.versionParentId} is null
          and (${game.gameType} is null or ${game.gameType} in ${RECOMMENDABLE_TYPES})
          and ${game.firstReleaseDate} <= ${now}
          and exists (select 1 from ${cover} where ${cover.gameId} = c.id)
          and not exists (
            select 1 from ${userGames} owned
            left join ${game} e on e.id = owned.game_id
            where owned.user_id = ${userId} and (owned.game_id = c.id or e.version_parent_id = c.id)
          )
      )
      select id from (
        select id, rank,
          row_number() over (partition by coalesce(series, -id) order by rank desc) as in_series
        from ranked
      ) r
      where in_series <= ${PER_SERIES}
      order by rank desc, id
      limit ${limit}
    `);
    return { results: await GameService.findCards(rows.rows.map((r) => Number(r.id))) };
  }
}
