import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "@playdamnit/db/relations";

import { getConfig } from "@/config";

const { postgresUrl } = getConfig();

// Requests and the job queue draw from the same pool
const POOL_SIZE = 20;

if (!postgresUrl) {
  throw new Error("POSTGRES_URL is not set");
}

// One pool per process: Drizzle and pg-boss share it (the LISTEN client stays dedicated,
// a notification session can't be pooled). Connections open lazily on first use.
// JIT is off: compiling a plan cost 300ms on the catalog counts that run in a few dozen, and
// no query here runs long enough to win it back.
export const pool = new Pool({
  connectionString: postgresUrl,
  max: POOL_SIZE,
  options: "-c jit=off",
});

export const db = drizzle({ client: pool, relations });

export const closeDb = () => pool.end();

export * from "@playdamnit/db/schema";
