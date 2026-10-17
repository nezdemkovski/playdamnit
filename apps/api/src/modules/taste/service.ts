import { sql } from "drizzle-orm";
import { user, userGames } from "@playdamnit/db/schema";

import { db } from "@/db/postgres";
import { GameService } from "@/modules/game/service";
import { followedAmong } from "@/utils/social";

export const MAX_TASTE_MATCHES = 30;
/** Games two members must both have graded before their grades say anything */
export const MIN_SHARED_GRADES = 3;
/** Shared games shown with each match, the ones both graded highest */
const SHOWN_SHARED = 3;
// Agreement drops by this much per point of average grade gap (0–10): a full grade band apart
// (S against A) is 87, four points apart is 50
const POINTS_PER_GAP = 12.5;

export class TasteService {
  /**
   * Members whose grades agree with the viewer's: over the games both have graded, how close
   * the grades are (0–100), ranked by agreement and, on a log scale, how many games they share.
   * Only members with a public list; each comes with the shared games both graded highest.
   */
  static async matches(viewerId: string, limit: number) {
    const rows = await db.execute<{
      id: string;
      username: string | null;
      name: string;
      image: string | null;
      shared: number;
      agreement: number;
      top: number[];
    }>(sql`
      with mine as (
        select ${userGames.gameId} as game_id, ${userGames.rating} as rating
        from ${userGames}
        where ${userGames.userId} = ${viewerId} and ${userGames.rating} > 0
      ),
      pairs as (
        select theirs.user_id, theirs.game_id, mine.rating as a, theirs.rating as b
        from ${userGames} theirs
        join mine on mine.game_id = theirs.game_id
        join ${user} on ${user.id} = theirs.user_id and ${user.listPublic}
        where theirs.user_id <> ${viewerId} and theirs.rating > 0
      ),
      scored as (
        select user_id, count(*)::int as shared,
          greatest(0, round(100 - avg(abs(a - b)) * ${POINTS_PER_GAP}))::int as agreement
        from pairs
        group by user_id
        having count(*) >= ${MIN_SHARED_GRADES}
      )
      select ${user.id} as id, ${user.username} as username, ${user.name} as name,
        ${user.image} as image, s.shared, s.agreement,
        array(
          select p.game_id from pairs p where p.user_id = s.user_id
          order by p.a + p.b desc, p.game_id limit ${SHOWN_SHARED}
        ) as top
      from scored s
      join ${user} on ${user.id} = s.user_id
      order by s.agreement * ln(1 + s.shared) desc, s.shared desc, ${user.id}
      limit ${limit}
    `);
    const matches = rows.rows;
    const [cards, following] = await Promise.all([
      GameService.findCards([...new Set(matches.flatMap((m) => m.top.map(Number)))]),
      followedAmong(
        viewerId,
        matches.map((m) => m.id),
      ),
    ]);
    const byId = new Map(cards.map((card) => [card.id, card]));
    return {
      results: matches.map((m) => ({
        id: m.id,
        username: m.username,
        name: m.name,
        image: m.image,
        isFollowing: following.has(m.id),
        shared: Number(m.shared),
        agreement: Number(m.agreement),
        games: m.top.map((id) => byId.get(Number(id))).filter((card) => card !== undefined),
      })),
    };
  }
}
