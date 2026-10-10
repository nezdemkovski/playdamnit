import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.POSTGRES_URL;

if (!dbUrl) {
  throw new Error("POSTGRES_URL is not set");
}

export default defineConfig({
  schema: "./db/postgres/schema.ts",
  out: "./db/postgres/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
