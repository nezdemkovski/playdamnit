-- Media and link rows are keyed by their IGDB ids from now on. They are derived data and the
-- librarian rewrites them on every game write, so the old identity-keyed rows are simply dropped
-- (the full catalog sync, or any refresh of a game, brings them back).
TRUNCATE TABLE "cover", "screenshot", "website";--> statement-breakpoint
ALTER TABLE "cover" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "screenshot" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "website" ALTER COLUMN "id" DROP IDENTITY;