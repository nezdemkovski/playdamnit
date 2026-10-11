import type { Game } from "@playdamnit/api-client";
import type { UIMessage } from "ai";

// Mirrors the search_games tool of the API's chat agent (apps/api/src/modules/chat/agent.ts)
export type ChatGameStatus = "finished" | "playing" | "dropped" | "want_to_play";

export interface SearchGamesInput {
  query: string;
  rating?: number;
  status?: ChatGameStatus;
  review?: string;
}

export interface SearchGamesOutput {
  results: Game[];
  userRating?: number;
  userStatus?: ChatGameStatus;
  userReview?: string;
}

export type ChatUIMessage = UIMessage<
  never,
  never,
  { search_games: { input: SearchGamesInput; output: SearchGamesOutput } }
>;
