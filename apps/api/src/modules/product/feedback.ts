import { createHash } from "node:crypto";

import { HttpHeader, HttpMethod, MimeType } from "@/utils/enums";
import { BadRequestError, ServiceUnavailableError } from "@/utils/errors";
import { FeedbackKind, type FeedbackInput } from "./model";

type Fetcher = typeof fetch;
interface Options {
  apiKey?: string;
  teamId?: string;
  projectId?: string;
  fetcher?: Fetcher;
}
interface Actor {
  id: string;
  username?: string | null;
}

/** Retries for one account/request pair always address the same Linear issue, including after a timeout. */
export function feedbackId(userId: string, requestId: string) {
  const bytes = createHash("sha256")
    .update(`playdamnit-feedback:${userId}:${requestId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createFeedbackService(options: Options) {
  const fetcher = options.fetcher ?? fetch;
  async function graphql(query: string, variables: Record<string, unknown>) {
    const response = await fetcher("https://api.linear.app/graphql", {
      method: HttpMethod.Post,
      headers: {
        [HttpHeader.Authorization]: options.apiKey!,
        [HttpHeader.ContentType]: MimeType.Json,
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => {
      throw new ServiceUnavailableError("Feedback could not be sent. Please try again.");
    });
    if (!response.ok)
      throw new ServiceUnavailableError("Feedback could not be sent. Please try again.");
    return response.json() as Promise<{
      data?: { issue?: { id: string }; issueCreate?: { success: boolean; issue?: { id: string } } };
      errors?: unknown[];
    }>;
  }
  return {
    async submit(actor: Actor, input: FeedbackInput) {
      if (!options.apiKey || !options.teamId || !options.projectId) {
        throw new ServiceUnavailableError(
          "Feedback is temporarily unavailable. Please try again later.",
        );
      }
      const title = input.title.trim();
      const message = input.message.trim();
      if (!title || !message) throw new BadRequestError("A title and message are required");
      const id = feedbackId(actor.id, input.requestId);
      const existing = await graphql("query Feedback($id: String!) { issue(id: $id) { id } }", {
        id,
      });
      if (existing.data?.issue?.id === id) return { id };
      const description = [
        message,
        "---",
        `Member: @${actor.username ?? actor.id}`,
        `Platform: ${input.platform}`,
        `App version: ${input.appVersion ?? "unknown"}`,
        `Language: ${input.locale ?? "unknown"}`,
        `Feedback reference: ${id}`,
      ].join("\n\n");
      try {
        const result = await graphql(
          "mutation Feedback($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id } } }",
          {
            input: {
              id,
              teamId: options.teamId,
              projectId: options.projectId,
              title: `[${input.kind === FeedbackKind.Bug ? "Bug" : "Feature"}] ${title}`,
              description,
            },
          },
        );
        if (
          !result.errors?.length &&
          result.data?.issueCreate?.success &&
          result.data.issueCreate.issue?.id === id
        ) {
          return { id };
        }
      } catch {
        /* A timeout can happen after Linear accepted the issue. Check before asking the member to retry. */
      }
      const confirmed = await graphql("query Feedback($id: String!) { issue(id: $id) { id } }", {
        id,
      });
      if (confirmed.data?.issue?.id === id) return { id };
      throw new ServiceUnavailableError("Feedback could not be sent. Please try again.");
    },
  };
}
