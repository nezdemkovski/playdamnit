import { GameService } from "@/modules/game/service";
import { RecommendationService } from "@/modules/recommendation/service";
import { ReviewService } from "@/modules/review/service";
import { UserService } from "@/modules/user/service";
import { GameSort } from "@/utils/enums";

const RAIL_SIZE = 20;
const FRESH_REVIEWS = 6;
const FEED_SIZE = 12;
const DAY_SECONDS = 86_400;

/**
 * Everything the home page shows in one answer instead of one request per rail: the catalog
 * rails, the latest reviews and, for a signed-in viewer, the friends feed and the picks for
 * them. The rails skip the match counts; they never page.
 */
export abstract class HomeService {
  static async load(viewerId: string | null) {
    const now = Math.floor(Date.now() / 1000);
    const rail = { withTotal: false };
    const [trending, newReleases, thisWeek, freshReviews, feed, forYou] = await Promise.all([
      GameService.findGames({ sort: GameSort.Popular, limit: RAIL_SIZE }, rail),
      GameService.findGames({ sort: GameSort.Recent, limit: RAIL_SIZE }, rail),
      GameService.findGames(
        {
          sort: GameSort.Date,
          releasedFrom: now - DAY_SECONDS,
          releasedTo: now + 7 * DAY_SECONDS,
          limit: RAIL_SIZE,
        },
        rail,
      ),
      ReviewService.list({ viewerId, limit: FRESH_REVIEWS, offset: 0, withGame: true }),
      viewerId ? UserService.feed(viewerId, { limit: FEED_SIZE, offset: 0 }) : null,
      viewerId ? RecommendationService.forUser(viewerId, RAIL_SIZE) : null,
    ]);
    return {
      trending: trending.results,
      newReleases: newReleases.results,
      thisWeek: thisWeek.results,
      freshReviews: freshReviews.results,
      feed: feed?.results ?? null,
      forYou: forYou?.results ?? null,
    };
  }
}
