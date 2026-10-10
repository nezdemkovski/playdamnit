import { Elysia, t } from "elysia";
import { streamText, tool, type ModelMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { searchGamesWithCache } from "@/utils/searchGames";
import { betterAuth } from "@/lib/betterAuth";
import { getConfig } from "@/config";
import { createLogger } from "@/utils/enhancedLogger";
import { ServiceUnavailableError } from "@/utils/errors";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";

const logger = createLogger("ai-chat");

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;

// Every message costs an LLM call and may enqueue IGDB searches
const chatLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

const searchGamesTool = tool({
  description: "Search for games by name or description",
  inputSchema: z.object({
    query: z.string().max(100).describe("The search query for finding games"),
    rating: z.number().min(0).max(10).optional(),
    status: z
      .enum(["finished", "playing", "dropped", "want_to_play"])
      .optional(),
    review: z.string().max(5000).optional(),
  }),
  execute: async (input) => {
    const searchGames = await searchGamesWithCache(input.query, 10);

    return {
      results: searchGames.results,
      userRating: input.rating,
      userStatus: input.status,
      userReview: input.review,
    };
  },
});

const systemPrompt = `You are a helpful gaming assistant that helps users track games they've played. 
When a user mentions a game they've played, use the search_games tool to find the game.
If the user mentions a rating (e.g., "I give it 8/10"), extract this as a number between 0-10 for the rating parameter.
If the user mentions a status (e.g., "finished", "playing", "dropped", "want to play"), extract this for the status parameter.
If the user provides any comments or review about the game, extract this for the review parameter.

Be conversational and friendly. If the user doesn't mention a specific game, just chat normally.`;

export const postAIChat = new Elysia().use(betterAuth).post("/chat/ai", {
  auth: true,
  body: t.Object({
    messages: t.Array(
      t.Object({
        role: t.Union([t.Literal("user"), t.Literal("assistant")]),
        content: t.Nullable(t.String({ maxLength: MAX_MESSAGE_LENGTH })),
      }),
      { minItems: 1, maxItems: MAX_MESSAGES }
    ),
  }),
}, ({ body, user, request, server }) => {
  const { openaiApiKey, openaiModel } = getConfig();
  if (!openaiApiKey) {
    throw new ServiceUnavailableError("AI chat is not configured");
  }

  chatLimiter.check(clientKey({ request, server }, user.id));

  // Only user/assistant turns come from the client; the system prompt is ours
  const messages: ModelMessage[] = body.messages.map((message) =>
    message.role === "user"
      ? { role: "user", content: message.content ?? "" }
      : { role: "assistant", content: message.content ?? "" }
  );

  const result = streamText({
    model: openai(openaiModel),
    system: systemPrompt,
    messages,
    tools: {
      search_games: searchGamesTool,
    },
    onError: ({ error }) => {
      logger.exception(error, { operation: "streamText", userId: user.id });
    },
  });

  return result.toTextStreamResponse();
});
