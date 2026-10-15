import { GameService } from "@/modules/game/service";
import { RecommendationService } from "@/modules/recommendation/service";
import { ReviewService } from "@/modules/review/service";
import { TasteService } from "@/modules/taste/service";
import { UserService } from "@/modules/user/service";
import { GameSort } from "@/utils/enums";

const RAIL_SIZE = 20;
const FRESH_REVIEWS = 6;
const FEED_SIZE = 12;
const BEST_OF_YEAR = 12;
const TASTE_MATCHES = 10;
// The week strip: today and the six days after, with each day's most popular releases
const WEEK_DAYS = 7;
const WEEK_DAY_GAMES = 12;
const DAY_SECONDS = 86_400;

/**
 * Everything the home screens (web and iOS) show in one answer, ready to render: the catalog
 * rails, the week of releases by UTC day, the year's best, the latest reviews and, for a
 * signed-in viewer, the friends feed, the picks for them and the members with their taste.
 * The rails skip the match counts; they never page.
 */
export abstract class HomeService {
  static async load(viewerId: string | null) {
    const now = new Date();
    const today = Math.floor(now.getTime() / 1000 / DAY_SECONDS) * DAY_SECONDS;
    const year = now.getUTCFullYear();
    const rail = { withTotal: false };
    const [trending, newReleases, thisWeek, bestOfYear, freshReviews, feed, forYou, taste] =
      await Promise.all([
        GameService.findGames({ sort: GameSort.Popular, limit: RAIL_SIZE }, rail),
        GameService.findGames({ sort: GameSort.Recent, limit: RAIL_SIZE }, rail),
        GameService.releasesByDay(today, WEEK_DAYS, WEEK_DAY_GAMES),
        GameService.findGames({ sort: GameSort.Rating, year, limit: BEST_OF_YEAR }, rail),
        ReviewService.list({ viewerId, limit: FRESH_REVIEWS, offset: 0, withGame: true }),
        viewerId ? UserService.feed(viewerId, { limit: FEED_SIZE, offset: 0 }) : null,
        viewerId ? RecommendationService.forUser(viewerId, RAIL_SIZE) : null,
        viewerId ? TasteService.matches(viewerId, TASTE_MATCHES) : null,
      ]);
    return {
      trending: trending.results,
      newReleases: newReleases.results,
      thisWeek,
      bestOfYear: { year, games: bestOfYear.results },
      freshReviews: freshReviews.results,
      feed: feed?.results ?? null,
      forYou: forYou?.results ?? null,
      tasteMatches: taste?.results ?? null,
    };
  }
}
