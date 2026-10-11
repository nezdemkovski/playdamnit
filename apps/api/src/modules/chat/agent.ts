import { isStepCount, tool, ToolLoopAgent, type LanguageModel } from "ai";
import { z } from "zod";

import { searchGames } from "@/utils/searchGames";
import { UserGameStatus } from "@playdamnit/db/enums";

const SEARCH_RESULT_LIMIT = 10;

// The statuses the web app's add-game form offers
const CHAT_STATUSES = [
  UserGameStatus.Finished,
  UserGameStatus.Playing,
  UserGameStatus.Dropped,
  UserGameStatus.WantToPlay,
] as const;

// IGDB game_type ids that count as "games" for the assistant's "games only" filter:
// Main Game, Remake, Remaster, Expanded Game
const MAIN_GAME_TYPES = new Set([0, 8, 9, 10]);

const isMainGame = (game: { gameType: number | null }) =>
  game.gameType === null || MAIN_GAME_TYPES.has(game.gameType);

const instructions = `You are a helpful gaming assistant that helps users track games they've played.
When a user mentions a game they've played or want to play, call search_games to find it.
If the user mentions a rating (e.g. "I give it 8/10"), pass it as a number between 0 and 10.
If the user mentions a status, pass one of: ${CHAT_STATUSES.join(", ")}.
If the user comments on the game, pass the comment as the review.
The app shows search results to the user as cards they can add to their library, so after a search
reply with one short sentence: confirm the match, or ask them to pick one if there are several.
If nothing was found, say so and suggest a different spelling.
If the user doesn't mention a specific game, just chat normally. Keep answers brief.`;

const createSearchGamesTool = (showOnlyGames: boolean) =>
  tool({
    description: "Search the game catalog by name",
    inputSchema: z.object({
      query: z.string().min(1).max(100).describe("The game name to search for"),
      rating: z.number().min(0).max(10).optional().describe("The user's rating, 0-10"),
      status: z.enum(CHAT_STATUSES).optional().describe("Where the user is with the game"),
      review: z.string().max(5000).optional().describe("The user's comments about the game"),
    }),
    execute: async ({ query, rating, status, review }) => {
      const { results } = await searchGames(query, { limit: SEARCH_RESULT_LIMIT });

      return {
        results: showOnlyGames ? results.filter(isMainGame) : results,
        userRating: rating,
        userStatus: status,
        userReview: review,
      };
    },
    // The UI renders full cards; the model only needs enough to tell the games apart
    toModelOutput: ({ output }) => ({
      type: "json",
      value: output.results.map((game) => ({
        id: game.id,
        name: game.name,
        releaseYear: game.firstReleaseDate
          ? new Date(game.firstReleaseDate * 1000).getUTCFullYear()
          : null,
      })),
    }),
  });

export const createChatAgent = (model: LanguageModel) =>
  new ToolLoopAgent({
    model,
    instructions,
    tools: { search_games: createSearchGamesTool(true) },
    callOptionsSchema: z.object({ showOnlyGames: z.boolean() }),
    prepareCall: ({ options, ...settings }) => ({
      ...settings,
      tools: { search_games: createSearchGamesTool(options.showOnlyGames) },
    }),
    // Search, then answer; a few extra steps for re-searching with another spelling
    stopWhen: isStepCount(4),
  });
