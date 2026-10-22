import { Elysia } from "elysia";
import { sql } from "drizzle-orm";

import { db } from "@/db/postgres";
import { gameToPlatform, LOCAL_PLATFORM_MIN_ID } from "@playdamnit/db/schema";
import { catalogRules } from "@/modules/catalog/rules";

const hasGames = (platformId: unknown) =>
  sql`exists (select 1 from ${gameToPlatform} where ${gameToPlatform.platformId} = ${platformId})`;

/**
 * Lookup tables for filters and pickers: genres, platforms that have games, game types, and the
 * local platforms (Steam Deck, ...) that can be chosen for a playthrough but have no catalog games,
 * plus the server's rules for clients (`catalogRules`).
 */
export const getCatalogLookups = new Elysia().get("/catalog", async () => {
  const [genres, platforms, localPlatforms, types] = await Promise.all([
    db.query.genre.findMany({ orderBy: { name: "asc" } }),
    db.query.platform.findMany({
      orderBy: { name: "asc" },
      where: { id: { lt: LOCAL_PLATFORM_MIN_ID }, RAW: (t) => hasGames(t.id) },
    }),
    db.query.platform.findMany({
      orderBy: { id: "asc" },
      where: { id: { gte: LOCAL_PLATFORM_MIN_ID } },
    }),
    db.query.type.findMany({ orderBy: { id: "asc" } }),
  ]);
  return { genres, platforms, localPlatforms, types, ...catalogRules() };
});
