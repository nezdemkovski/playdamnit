import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "@playdamnit/db/relations";

import { getConfig } from "@/config";

const { postgresUrl } = getConfig();

if (!postgresUrl) {
  throw new Error("POSTGRES_URL is not set");
}

// One pool per process: Drizzle and pg-boss share it (the LISTEN client stays dedicated,
// a notification session can't be pooled). Connections open lazily on first use.
export const pool = new Pool({ connectionString: postgresUrl });

export const db = drizzle({ client: pool, relations });

export const closeDb = () => pool.end();

export * from "@playdamnit/db/schema";
