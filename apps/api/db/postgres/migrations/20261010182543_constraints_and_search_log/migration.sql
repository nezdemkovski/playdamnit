CREATE TABLE "igdb_search_log" (
	"query" text PRIMARY KEY NOT NULL,
	"searched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- ended_at was created as finished_at NOT NULL DEFAULT now() and renamed since; the schema
-- (and the "playing"/"backlog" statuses) need it nullable
ALTER TABLE "user_games" ALTER COLUMN "ended_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_games" ALTER COLUMN "ended_at" DROP DEFAULT;--> statement-breakpoint
-- Drop duplicate library entries (keep the oldest) before adding the unique constraint
DELETE FROM "user_games" a USING "user_games" b
WHERE a."user_id" = b."user_id" AND a."game_id" = b."game_id"
  AND (a."added_at", a."id") > (b."added_at", b."id");--> statement-breakpoint
DELETE FROM "user_follows" a USING "user_follows" b
WHERE a."follower_id" = b."follower_id" AND a."following_id" = b."following_id"
  AND (a."created_at", a."id") > (b."created_at", b."id");--> statement-breakpoint
DELETE FROM "user_follows" WHERE "follower_id" = "following_id";--> statement-breakpoint
DELETE FROM "user_metadata" a USING "user_metadata" b
WHERE a."user_id" = b."user_id" AND a."id" > b."id";--> statement-breakpoint
-- Old exports used 0 for "no platform"; unknown platforms can't satisfy the new FK
UPDATE "user_games" SET "platform_id" = NULL
WHERE "platform_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "platform" p WHERE p."id" = "user_games"."platform_id");--> statement-breakpoint
-- NOT VALID: existing entries may point at games the catalog hasn't fetched yet. The backend
-- re-fetches those on startup; run VALIDATE CONSTRAINT once the catalog has caught up.
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_platform_id_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platform"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_user_follows_following_id" ON "user_follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "idx_user_games_game_id" ON "user_games" USING btree ("game_id");--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_following_id_unique" UNIQUE("follower_id","following_id");--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_user_id_game_id_unique" UNIQUE("user_id","game_id");--> statement-breakpoint
ALTER TABLE "user_metadata" ADD CONSTRAINT "user_metadata_user_id_unique" UNIQUE("user_id");--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_no_self_follow" CHECK ("user_follows"."follower_id" <> "user_follows"."following_id");
