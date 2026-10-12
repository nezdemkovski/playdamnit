ALTER TABLE "game" ADD COLUMN "hypes" integer;--> statement-breakpoint
-- Backfill from the stored IGDB documents: `fields *` already brought hypes along
UPDATE "game" SET "hypes" = ("raw"->>'hypes')::integer WHERE "raw" ? 'hypes';--> statement-breakpoint
CREATE INDEX "idx_game_hypes" ON "game" ("hypes");
