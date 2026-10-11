import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import {
  catalogDirty,
  cover,
  externalGame,
  gameLocalization,
  screenshot,
  video,
  website,
} from "@playdamnit/db/schema";

// Child entities we can map back to a game: through the `game` field of the payload, or, when
// IGDB sends only an id (deletes), through the row we hold for that id
const CHILD_TABLES = {
  covers: cover,
  screenshots: screenshot,
  videos: video,
  websites: website,
  external_games: externalGame,
  game_localizations: gameLocalization,
} as const;

export const WEBHOOK_ENTITIES = [
  "games",
  ...(Object.keys(CHILD_TABLES) as (keyof typeof CHILD_TABLES)[]),
  // No table keyed by involved_company id: only resolvable through `game`
  "involved_companies",
] as const;
export const WEBHOOK_METHODS = ["create", "update", "delete"] as const;

type WebhookEntity = (typeof WEBHOOK_ENTITIES)[number];
type WebhookMethod = (typeof WEBHOOK_METHODS)[number];

const DELETED_REASON = "deleted";

/** Constant-time comparison of the X-Secret header with the configured secret. */
export const secretMatches = (given: string | null, expected: string): boolean => {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** IGDB posts the entity as JSON; depending on headers Elysia hands it over parsed or raw. */
export const parseWebhookPayload = (body: unknown): Record<string, unknown> | null => {
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : null;
};

const asId = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;

/** The game an event is about, or null when it can't be told (then the delta sync covers it). */
const resolveGameId = async (
  entity: WebhookEntity,
  payload: Record<string, unknown>,
): Promise<number | null> => {
  if (entity === "games") return asId(payload.id);

  const fromPayload = asId(payload.game);
  if (fromPayload) return fromPayload;

  if (!(entity in CHILD_TABLES)) return null;
  const table = CHILD_TABLES[entity as keyof typeof CHILD_TABLES];
  const id = asId(payload.id);
  if (!id) return null;

  const [row] = await db
    .select({ gameId: table.gameId })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  return row?.gameId ?? null;
};

/**
 * Record that a game needs re-fetching. A delete of the game itself wins over any other reason
 * already queued for it; the librarian's drain flags those games instead of fetching them.
 */
export const markDirty = async (
  entity: WebhookEntity,
  method: WebhookMethod,
  payload: Record<string, unknown>,
): Promise<number | null> => {
  const gameId = await resolveGameId(entity, payload);
  if (!gameId) return null;

  const reason = entity === "games" && method === "delete" ? DELETED_REASON : `${entity}:${method}`;

  await db
    .insert(catalogDirty)
    .values({ igdbId: gameId, reason })
    .onConflictDoUpdate({
      target: catalogDirty.igdbId,
      set: { reason: DELETED_REASON },
      setWhere: sql`excluded.reason = ${DELETED_REASON}`,
    });

  return gameId;
};
