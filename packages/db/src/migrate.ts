import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

// Runtime migrator (drizzle-kit is a dev tool and not needed in images)
export const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));

export const runMigrations = async (url: string) => {
  const db = drizzle(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await db.$client.close();
  }
};

if (import.meta.main) {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    console.error("POSTGRES_URL is not set");
    process.exit(1);
  }
  await runMigrations(url);
  console.log("Migrations applied");
}
