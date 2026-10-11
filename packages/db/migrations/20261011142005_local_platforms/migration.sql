-- Platforms IGDB doesn't have (yet). Ids from 900000 never collide with IGDB's, and sync-lookups only
-- upserts by id, so these rows survive every sync. Slugs are prefixed so a future IGDB platform with
-- the plain slug can't hit the unique constraint.
INSERT INTO "platform" ("id", "name", "slug", "abbreviation") VALUES
	(900001, 'Steam Deck', 'local-steam-deck', 'Deck'),
	(900002, 'Steam Machine', 'local-steam-machine', 'Machine'),
	(900003, 'Steam Frame', 'local-steam-frame', 'Frame')
ON CONFLICT ("id") DO NOTHING;
