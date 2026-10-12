CREATE TABLE "steam_playtime" (
	"user_id" text,
	"game_id" integer,
	"day" date,
	"minutes" integer NOT NULL,
	CONSTRAINT "steam_playtime_pkey" PRIMARY KEY("user_id","game_id","day")
);
--> statement-breakpoint
ALTER TABLE "user_games" ADD COLUMN "steam_minutes" integer;--> statement-breakpoint
ALTER TABLE "user_games" ADD COLUMN "steam_last_played_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_steam_playtime_user_day" ON "steam_playtime" ("user_id","day");--> statement-breakpoint
ALTER TABLE "steam_playtime" ADD CONSTRAINT "steam_playtime_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "steam_playtime" ADD CONSTRAINT "steam_playtime_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;