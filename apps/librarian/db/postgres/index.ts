import { drizzle } from "drizzle-orm/node-postgres";
import { relations } from "@playdamnit/db/relations";

const postgresUrl = process.env.POSTGRES_URL;

if (!postgresUrl) {
  throw new Error("POSTGRES_URL is not set");
}

export const db = drizzle(postgresUrl, { relations });

export * from "@playdamnit/db/schema";
