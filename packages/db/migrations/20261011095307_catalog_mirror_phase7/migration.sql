DROP TABLE "game_to_similar_game";--> statement-breakpoint
DROP TABLE "game_to_type";--> statement-breakpoint
DROP TABLE "igdb_search_log";--> statement-breakpoint
ALTER TABLE "game" DROP COLUMN "involved_companies";--> statement-breakpoint
ALTER TABLE "game" DROP COLUMN "keywords";--> statement-breakpoint
-- Library rows may still point at games the lazy catalog never fetched. Give them a stub row
-- flagged as deleted and never synced: refresh-stale-games re-fetches it within a day and the
-- writer clears the flag if IGDB has the game. Then the FK can finally be validated.
INSERT INTO "game" ("id", "name", "slug", "search_names", "deleted_at")
SELECT DISTINCT ug."game_id", 'Unknown game ' || ug."game_id", 'unknown-game-' || ug."game_id", 'Unknown game ' || ug."game_id", now()
FROM "user_games" ug
WHERE NOT EXISTS (SELECT 1 FROM "game" g WHERE g."id" = ug."game_id");--> statement-breakpoint
ALTER TABLE "user_games" VALIDATE CONSTRAINT "user_games_game_id_game_id_fk";
