CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_game_name";
--> statement-breakpoint
CREATE INDEX "idx_game_name_trgm" ON "game" USING gin("name" gin_trgm_ops);
