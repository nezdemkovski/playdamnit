import { drizzle } from "drizzle-orm/bun-sql";

import { relations } from "./relations";
import { getConfig } from "@/config";

const { postgresUrl } = getConfig();

if (!postgresUrl) {
  throw new Error("POSTGRES_URL is not set");
}

export const db = drizzle(postgresUrl, { relations });

export * from "./schema";
