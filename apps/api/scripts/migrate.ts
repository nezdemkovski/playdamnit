import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

// Runtime migrator (drizzle-kit is a dev tool and not needed in the image)
const url = process.env.POSTGRES_URL;
if (!url) {
  console.error("POSTGRES_URL is not set");
  process.exit(1);
}

const db = drizzle(url);
await migrate(db, { migrationsFolder: "./db/postgres/migrations" });
await db.$client.close();
console.log("Migrations applied");
