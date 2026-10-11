import { Elysia } from "elysia";

import { db } from "@/db/postgres";

/** Lookup tables for filters: genres, platforms (the ones with games) and game types */
export const getCatalogLookups = new Elysia().get("/catalog", async () => {
  const [genres, platforms, types] = await Promise.all([
    db.query.genre.findMany({ orderBy: { name: "asc" } }),
    db.query.platform.findMany({
      orderBy: { name: "asc" },
      where: { RAW: (t) => sqlHasGames(t.id) },
    }),
    db.query.type.findMany({ orderBy: { id: "asc" } }),
  ]);
  return { genres, platforms, types };
});

import { sql } from "drizzle-orm";
import { gameToPlatform } from "@playdamnit/db/schema";

const sqlHasGames = (platformId: unknown) =>
  sql`exists (select 1 from ${gameToPlatform} where ${gameToPlatform.platformId} = ${platformId})`;
