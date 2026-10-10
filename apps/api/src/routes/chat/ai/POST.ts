import { createAgentUIStreamResponse } from "ai";
import { openai } from "@ai-sdk/openai";
import { Elysia, t } from "elysia";

import { getConfig } from "@/config";
import { betterAuth } from "@/lib/betterAuth";
import { createChatAgent } from "@/modules/chat/agent";
import { createLogger } from "@/utils/enhancedLogger";
import { BadRequestError, ServiceUnavailableError } from "@/utils/errors";
import { clientKey, createRateLimiter } from "@/utils/rateLimit";

const logger = createLogger("ai-chat");

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;

// Every message costs an LLM call and may enqueue IGDB searches
const chatLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60_000 });

export const postAIChat = new Elysia().use(betterAuth).post(
  "/chat/ai",
  {
    auth: true,
    // Shape of useChat's UI messages; createAgentUIStreamResponse validates the parts in depth
    body: t.Object({
      messages: t.Array(
        t.Object(
          {
            id: t.String(),
            // No "system": the instructions are ours
            role: t.Union([t.Literal("user"), t.Literal("assistant")]),
            parts: t.Array(t.Object({ type: t.String() }, { additionalProperties: true })),
          },
          { additionalProperties: true },
        ),
        { minItems: 1, maxItems: MAX_MESSAGES },
      ),
      showOnlyGames: t.Optional(t.Boolean()),
    }),
  },
  ({ body, user, request, server }) => {
    const { openaiApiKey, openaiModel } = getConfig();
    if (!openaiApiKey) {
      throw new ServiceUnavailableError("AI chat is not configured");
    }

    chatLimiter.check(clientKey({ request, server }, user.id));

    for (const message of body.messages) {
      for (const part of message.parts) {
        const text = (part as { text?: unknown }).text;
        if (part.type === "text" && typeof text === "string" && text.length > MAX_MESSAGE_LENGTH) {
          throw new BadRequestError(`Messages must be at most ${MAX_MESSAGE_LENGTH} characters`);
        }
      }
    }

    return createAgentUIStreamResponse({
      agent: createChatAgent(openai(openaiModel)),
      uiMessages: body.messages,
      options: { showOnlyGames: body.showOnlyGames ?? true },
      onError: (error) => {
        logger.exception(error, { operation: "chat", userId: user.id });
        return "The assistant ran into a problem. Please try again.";
      },
    });
  },
);
