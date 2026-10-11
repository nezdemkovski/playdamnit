CREATE TABLE "catalog_dirty" (
	"igdb_id" integer PRIMARY KEY,
	"reason" text NOT NULL,
	"marked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" integer PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" integer PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "external_game" (
	"id" integer PRIMARY KEY,
	"game_id" integer NOT NULL,
	"source_id" integer,
	"name" text,
	"uid" text,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "external_game_source" (
	"id" integer PRIMARY KEY,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_localization" (
	"id" integer PRIMARY KEY,
	"game_id" integer NOT NULL,
	"name" text,
	"region_id" integer,
	"cover_hash" text,
	"cover_width" integer,
	"cover_height" integer
);
--> statement-breakpoint
CREATE TABLE "game_time_to_beat" (
	"game_id" integer PRIMARY KEY,
	"hastily" integer,
	"normally" integer,
	"completely" integer,
	"count" integer
);
--> statement-breakpoint
CREATE TABLE "game_to_collection" (
	"game_id" integer,
	"collection_id" integer,
	CONSTRAINT "game_to_collection_pkey" PRIMARY KEY("game_id","collection_id")
);
--> statement-breakpoint
CREATE TABLE "game_to_company" (
	"game_id" integer,
	"company_id" integer,
	"developer" boolean DEFAULT false NOT NULL,
	"publisher" boolean DEFAULT false NOT NULL,
	"porting" boolean DEFAULT false NOT NULL,
	"supporting" boolean DEFAULT false NOT NULL,
	CONSTRAINT "game_to_company_pkey" PRIMARY KEY("game_id","company_id")
);
--> statement-breakpoint
CREATE TABLE "game_to_theme" (
	"game_id" integer,
	"theme_id" integer,
	CONSTRAINT "game_to_theme_pkey" PRIMARY KEY("game_id","theme_id")
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"entity" text PRIMARY KEY,
	"cursor" text,
	"last_run_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "theme" (
	"id" integer PRIMARY KEY,
	"name" text NOT NULL,
	"slug" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "video" (
	"id" integer PRIMARY KEY,
	"game_id" integer NOT NULL,
	"name" text,
	"video_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "total_rating_count" integer;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "first_release_date_precision" text;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "game_type" integer;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "parent_game_id" integer;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "version_parent_id" integer;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "alternative_names" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "search_names" text;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "similar_game_ids" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "raw" jsonb;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "igdb_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "game" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "platform" ADD COLUMN "abbreviation" text;--> statement-breakpoint
ALTER TABLE "user_follows" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "user_games" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
ALTER TABLE "user_metadata" ALTER COLUMN "id" SET DEFAULT uuidv7();--> statement-breakpoint
CREATE INDEX "idx_collection_slug" ON "collection" ("slug");--> statement-breakpoint
CREATE INDEX "idx_company_slug" ON "company" ("slug");--> statement-breakpoint
CREATE INDEX "idx_external_game_game_id" ON "external_game" ("game_id");--> statement-breakpoint
CREATE INDEX "idx_external_game_source_id" ON "external_game" ("source_id");--> statement-breakpoint
CREATE INDEX "idx_game_search_names_trgm" ON "game" USING gin ("search_names" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_game_type" ON "game" ("game_type");--> statement-breakpoint
CREATE INDEX "idx_game_parent_game_id" ON "game" ("parent_game_id");--> statement-breakpoint
CREATE INDEX "idx_game_version_parent_id" ON "game" ("version_parent_id");--> statement-breakpoint
CREATE INDEX "idx_game_last_synced_at" ON "game" ("last_synced_at");--> statement-breakpoint
CREATE INDEX "idx_game_localization_game_id" ON "game_localization" ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2col_game_id" ON "game_to_collection" ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2col_collection_id" ON "game_to_collection" ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_g2c_game_id" ON "game_to_company" ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2c_company_id" ON "game_to_company" ("company_id");--> statement-breakpoint
CREATE INDEX "idx_g2th_game_id" ON "game_to_theme" ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2th_theme_id" ON "game_to_theme" ("theme_id");--> statement-breakpoint
CREATE INDEX "idx_theme_slug" ON "theme" ("slug");--> statement-breakpoint
CREATE INDEX "idx_video_game_id" ON "video" ("game_id");--> statement-breakpoint
ALTER TABLE "external_game" ADD CONSTRAINT "external_game_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_localization" ADD CONSTRAINT "game_localization_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_time_to_beat" ADD CONSTRAINT "game_time_to_beat_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_to_collection" ADD CONSTRAINT "game_to_collection_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_to_collection" ADD CONSTRAINT "game_to_collection_collection_id_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collection"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_to_company" ADD CONSTRAINT "game_to_company_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_to_company" ADD CONSTRAINT "game_to_company_company_id_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_to_theme" ADD CONSTRAINT "game_to_theme_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_to_theme" ADD CONSTRAINT "game_to_theme_theme_id_theme_id_fkey" FOREIGN KEY ("theme_id") REFERENCES "theme"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "video" ADD CONSTRAINT "video_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
-- ─── Lookup tables move to IGDB ids ──────────────────────────────────────────
-- Every catalog table mirrors IGDB, so platform/genre/game_mode/type/website_type ids become the
-- IGDB ids. The mapping is embedded (platforms from igdb.com, the rest from IGDB's lookup endpoints,
-- 2026-10-11) so the migration needs no network. The librarian's sync-lookups job refreshes names
-- afterwards. Only user_games.platform_id is user data: the migration refuses to run if a library
-- references a platform that has no IGDB id. Everything else is derived and unmatched rows are
-- dropped; the catalog refresh brings them back.
CREATE TEMP TABLE igdb_lookup_map (entity text NOT NULL, key text NOT NULL, igdb_id integer NOT NULL, PRIMARY KEY (entity, key));--> statement-breakpoint
INSERT INTO igdb_lookup_map (entity, key, igdb_id) VALUES
('platform','1292-advanced-programmable-video-system',139),
('platform','3do',50),
('platform','3ds',37),
('platform','64dd',416),
('platform','acorn-archimedes',116),
('platform','acorn-electron',134),
('platform','acpc',25),
('platform','advanced-pico-beena',507),
('platform','airconsole',389),
('platform','amiga-cd32',114),
('platform','amiga',16),
('platform','android',34),
('platform','apcw',154),
('platform','apple-iigs',115),
('platform','apple-pippin',476),
('platform','appleii',75),
('platform','arcade',52),
('platform','arcadia-2001',473),
('platform','arduboy',438),
('platform','astrocade',91),
('platform','atari-jaguar-cd',410),
('platform','atari-st',63),
('platform','atari2600',59),
('platform','atari5200',66),
('platform','atari7800',60),
('platform','atari8bit',65),
('platform','ay-3-8500',140),
('platform','ay-3-8603',145),
('platform','ay-3-8605',146),
('platform','ay-3-8606',147),
('platform','ay-3-8607',148),
('platform','ay-3-8610',141),
('platform','ay-3-8760',143),
('platform','bbcmicro',69),
('platform','blackberry',73),
('platform','blu-ray-player',239),
('platform','browser',82),
('platform','c-plus-4',94),
('platform','c16',93),
('platform','c64',15),
('platform','call-a-computer',107),
('platform','casio-loopy',380),
('platform','cdccyber70',109),
('platform','colecovision',68),
('platform','commodore-cdtv',158),
('platform','cpet',90),
('platform','daydream',164),
('platform','dc',23),
('platform','digiblast',486),
('platform','donner30',85),
('platform','dos',13),
('platform','dragon-32-slash-64',153),
('platform','dvd-player',238),
('platform','e-reader-slash-card-e-reader',510),
('platform','edsac--1',102),
('platform','elektor-tv-games-computer',505),
('platform','epoch-cassette-vision',375),
('platform','epoch-super-cassette-vision',376),
('platform','evercade',309),
('platform','exidy-sorcerer',236),
('platform','fairchild-channel-f',127),
('platform','famicom',99),
('platform','fds',51),
('platform','firetv',132),
('platform','fm-7',152),
('platform','fm-towns',118),
('platform','g-and-w',307),
('platform','gamate',378),
('platform','game-dot-com',379),
('platform','gamegear',35),
('platform','gb',33),
('platform','gba',24),
('platform','gbc',22),
('platform','gear-vr',388),
('platform','genesis-slash-megadrive',29),
('platform','gizmondo',474),
('platform','gt40',98),
('platform','gx4000',506),
('platform','handheld',411),
('platform','hp2100',104),
('platform','hp3000',105),
('platform','hyper-neo-geo-64',135),
('platform','hyperscan',407),
('platform','intellivision-amico',382),
('platform','intellivision',67),
('platform','ios',39),
('platform','jaguar',62),
('platform','laseractive',487),
('platform','leapster-explorer-slash-leadpad-explorer',413),
('platform','leapster',412),
('platform','leaptv',414),
('platform','legacy-computer',409),
('platform','linux',3),
('platform','lynx',61),
('platform','mac',14),
('platform','mega-duck-slash-cougar-boy',408),
('platform','meta-quest-2',386),
('platform','meta-quest-3',471),
('platform','microvision--1',89),
('platform','mobile',55),
('platform','msx2',53),
('platform','msx',27),
('platform','n64',4),
('platform','nds',20),
('platform','nec-pc-6000-series',157),
('platform','neo-geo-cd',136),
('platform','neo-geo-pocket-color',120),
('platform','neo-geo-pocket',119),
('platform','neogeoaes',80),
('platform','neogeomvs',79),
('platform','nes',18),
('platform','new-3ds',137),
('platform','ngage',42),
('platform','ngc',21),
('platform','nimrod',101),
('platform','nintendo-dsi',159),
('platform','nuon',122),
('platform','oculus-go',387),
('platform','oculus-quest',384),
('platform','oculus-rift',385),
('platform','oculus-vr',162),
('platform','odyssey--1',88),
('platform','odyssey-2-slash-videopac-g7000',133),
('platform','onlive',113),
('platform','ooparts',372),
('platform','ouya',72),
('platform','palm-os',417),
('platform','panasonic-jungle',477),
('platform','panasonic-m2',478),
('platform','pc-50x-family',142),
('platform','pc-8800-series',125),
('platform','pc-9800-series',149),
('platform','pc-fx',274),
('platform','pdp-8--1',97),
('platform','pdp10',96),
('platform','pdp11',108),
('platform','pdp1',95),
('platform','philips-cdi',117),
('platform','plato--1',110),
('platform','playdate',381),
('platform','playdia',308),
('platform','plug-and-play',377),
('platform','pocketstation',441),
('platform','pokemon-mini',166),
('platform','polymega',509),
('platform','ps2',8),
('platform','ps3',9),
('platform','ps4--1',48),
('platform','ps5',167),
('platform','ps',7),
('platform','psp',38),
('platform','psvita',46),
('platform','psvr2',390),
('platform','psvr',165),
('platform','r-zone',475),
('platform','satellaview',306),
('platform','saturn',32),
('platform','sdssigma7',106),
('platform','sega-cd-32x',482),
('platform','sega-cd',78),
('platform','sega-pico',339),
('platform','sega32',30),
('platform','series-x-s',169),
('platform','sfam',58),
('platform','sg1000',84),
('platform','sharp-mz-2200',374),
('platform','sharp-x68000',121),
('platform','sinclair-ql',406),
('platform','sinclair-zx81',373),
('platform','sms',64),
('platform','snes',19),
('platform','sol-20',237),
('platform','stadia',170),
('platform','steam-vr',163),
('platform','super-acan',480),
('platform','super-nes-cd-rom-system',131),
('platform','supergrafx',128),
('platform','switch-2',508),
('platform','switch',130),
('platform','tatung-einstein',155),
('platform','terebikko-slash-see-n-say-video-phone',479),
('platform','thomson-mo5',156),
('platform','ti-99',129),
('platform','tomy-tutor-slash-pyuta-slash-grandstand-tutor',481),
('platform','trs-80-color-computer',151),
('platform','trs-80',126),
('platform','turbografx-16-slash-pc-engine-cd',150),
('platform','turbografx16--1',86),
('platform','uzebox',504),
('platform','vc-4000',138),
('platform','vectrex',70),
('platform','vic-20',71),
('platform','virtualboy',87),
('platform','visionos',472),
('platform','visual-memory-unit-slash-visual-memory-system',440),
('platform','vsmile',439),
('platform','watara-slash-quickshot-supervision',415),
('platform','wii',5),
('platform','wiiu',41),
('platform','win',6),
('platform','windows-mixed-reality',161),
('platform','windows-mobile',405),
('platform','winphone',74),
('platform','wonderswan-color',123),
('platform','wonderswan',57),
('platform','x1',77),
('platform','xbox360',12),
('platform','xbox',11),
('platform','xboxone',49),
('platform','zeebo',240),
('platform','zod',44),
('platform','zxs',26),
('genre','point-and-click',2),
('genre','fighting',4),
('genre','shooter',5),
('genre','music',7),
('genre','platform',8),
('genre','puzzle',9),
('genre','racing',10),
('genre','real-time-strategy-rts',11),
('genre','role-playing-rpg',12),
('genre','simulator',13),
('genre','sport',14),
('genre','strategy',15),
('genre','turn-based-strategy-tbs',16),
('genre','tactical',24),
('genre','hack-and-slash-beat-em-up',25),
('genre','quiz-trivia',26),
('genre','pinball',30),
('genre','adventure',31),
('genre','indie',32),
('genre','arcade',33),
('genre','visual-novel',34),
('genre','card-and-board-game',35),
('genre','moba',36),
('game_mode','single-player',1),
('game_mode','multiplayer',2),
('game_mode','co-operative',3),
('game_mode','split-screen',4),
('game_mode','massively-multiplayer-online-mmo',5),
('game_mode','battle-royale',6),
('type','main game',0),
('type','dlc',1),
('type','expansion',2),
('type','bundle',3),
('type','standalone expansion',4),
('type','mod',5),
('type','episode',6),
('type','season',7),
('type','remake',8),
('type','remaster',9),
('type','expanded game',10),
('type','port',11),
('type','fork',12),
('type','pack',13),
('type','pack / addon',13),
('type','update',14),
('website_type','official website',1),
('website_type','community wiki',2),
('website_type','wikipedia',3),
('website_type','facebook',4),
('website_type','twitter',5),
('website_type','twitch',6),
('website_type','instagram',8),
('website_type','youtube',9),
('website_type','app store (iphone)',10),
('website_type','app store (ipad)',11),
('website_type','google play',12),
('website_type','steam',13),
('website_type','subreddit',14),
('website_type','itch',15),
('website_type','epic',16),
('website_type','gog',17),
('website_type','discord',18),
('website_type','bluesky',19),
('website_type','xbox',22),
('website_type','playstation',23),
('website_type','nintendo',24),
('website_type','meta',25),
('website_type','gamejolt',26),
('website_type','official',1),
('website_type','wikia',2),
('website_type','iphone',10),
('website_type','ipad',11),
('website_type','android',12),
('website_type','reddit',14),
('website_type','epicgames',16);--> statement-breakpoint
DO $$
DECLARE missing text;
BEGIN
  SELECT string_agg(DISTINCT p.slug, ', ') INTO missing
  FROM platform p
  WHERE EXISTS (SELECT 1 FROM user_games ug WHERE ug.platform_id = p.id)
    AND NOT EXISTS (SELECT 1 FROM igdb_lookup_map m WHERE m.entity = 'platform' AND m.key = p.slug);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Libraries reference platforms without a known IGDB id: %. Add them to the mapping and rerun.', missing;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "user_games" DROP CONSTRAINT "user_games_platform_id_platform_id_fk";--> statement-breakpoint
ALTER TABLE "game_to_platform" DROP CONSTRAINT "game_to_platform_platform_id_platform_id_fk";--> statement-breakpoint
ALTER TABLE "game_to_genre" DROP CONSTRAINT "game_to_genre_genre_id_genre_id_fk";--> statement-breakpoint
ALTER TABLE "game_to_game_mode" DROP CONSTRAINT "game_to_game_mode_game_mode_id_game_mode_id_fk";--> statement-breakpoint
ALTER TABLE "game_to_type" DROP CONSTRAINT "game_to_type_type_id_type_id_fk";--> statement-breakpoint
ALTER TABLE "website" DROP CONSTRAINT "website_type_id_website_type_id_fk";--> statement-breakpoint
ALTER TABLE "platform" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "genre" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "game_mode" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "type" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
ALTER TABLE "website_type" ALTER COLUMN "id" DROP IDENTITY;--> statement-breakpoint
-- References first move to the negated IGDB id (never collides with a current positive id),
-- unmatched references are dropped, then everything flips back to positive.
UPDATE "user_games" ug SET platform_id = -m.igdb_id FROM platform p JOIN igdb_lookup_map m ON m.entity = 'platform' AND m.key = p.slug WHERE ug.platform_id = p.id;--> statement-breakpoint
UPDATE "game_to_platform" r SET platform_id = -m.igdb_id FROM platform p JOIN igdb_lookup_map m ON m.entity = 'platform' AND m.key = p.slug WHERE r.platform_id = p.id;--> statement-breakpoint
UPDATE "game_to_genre" r SET genre_id = -m.igdb_id FROM genre p JOIN igdb_lookup_map m ON m.entity = 'genre' AND m.key = p.slug WHERE r.genre_id = p.id;--> statement-breakpoint
UPDATE "game_to_game_mode" r SET game_mode_id = -m.igdb_id FROM game_mode p JOIN igdb_lookup_map m ON m.entity = 'game_mode' AND m.key = p.slug WHERE r.game_mode_id = p.id;--> statement-breakpoint
UPDATE "game_to_type" r SET type_id = -m.igdb_id FROM type p JOIN igdb_lookup_map m ON m.entity = 'type' AND m.key = lower(p.type) WHERE r.type_id = p.id;--> statement-breakpoint
UPDATE "website" r SET type_id = -m.igdb_id FROM website_type p JOIN igdb_lookup_map m ON m.entity = 'website_type' AND m.key = lower(p.type) WHERE r.type_id = p.id;--> statement-breakpoint
DELETE FROM "game_to_platform" WHERE platform_id > 0;--> statement-breakpoint
DELETE FROM "game_to_genre" WHERE genre_id > 0;--> statement-breakpoint
DELETE FROM "game_to_game_mode" WHERE game_mode_id > 0;--> statement-breakpoint
DELETE FROM "game_to_type" WHERE type_id > 0;--> statement-breakpoint
UPDATE "website" SET type_id = NULL WHERE type_id > 0;--> statement-breakpoint
DELETE FROM "platform" p WHERE NOT EXISTS (SELECT 1 FROM igdb_lookup_map m WHERE m.entity = 'platform' AND m.key = p.slug);--> statement-breakpoint
DELETE FROM "genre" p WHERE NOT EXISTS (SELECT 1 FROM igdb_lookup_map m WHERE m.entity = 'genre' AND m.key = p.slug);--> statement-breakpoint
DELETE FROM "game_mode" p WHERE NOT EXISTS (SELECT 1 FROM igdb_lookup_map m WHERE m.entity = 'game_mode' AND m.key = p.slug);--> statement-breakpoint
DELETE FROM "type" p WHERE NOT EXISTS (SELECT 1 FROM igdb_lookup_map m WHERE m.entity = 'type' AND m.key = lower(p.type));--> statement-breakpoint
DELETE FROM "website_type" p WHERE NOT EXISTS (SELECT 1 FROM igdb_lookup_map m WHERE m.entity = 'website_type' AND m.key = lower(p.type));--> statement-breakpoint
UPDATE "platform" p SET id = -m.igdb_id FROM igdb_lookup_map m WHERE m.entity = 'platform' AND m.key = p.slug;--> statement-breakpoint
UPDATE "genre" p SET id = -m.igdb_id FROM igdb_lookup_map m WHERE m.entity = 'genre' AND m.key = p.slug;--> statement-breakpoint
UPDATE "game_mode" p SET id = -m.igdb_id FROM igdb_lookup_map m WHERE m.entity = 'game_mode' AND m.key = p.slug;--> statement-breakpoint
UPDATE "type" p SET id = -m.igdb_id FROM igdb_lookup_map m WHERE m.entity = 'type' AND m.key = lower(p.type);--> statement-breakpoint
UPDATE "website_type" p SET id = -m.igdb_id FROM igdb_lookup_map m WHERE m.entity = 'website_type' AND m.key = lower(p.type);--> statement-breakpoint
UPDATE "platform" SET id = -id;--> statement-breakpoint
UPDATE "genre" SET id = -id;--> statement-breakpoint
UPDATE "game_mode" SET id = -id;--> statement-breakpoint
UPDATE "type" SET id = -id;--> statement-breakpoint
UPDATE "website_type" SET id = -id;--> statement-breakpoint
UPDATE "user_games" SET platform_id = -platform_id WHERE platform_id < 0;--> statement-breakpoint
UPDATE "game_to_platform" SET platform_id = -platform_id;--> statement-breakpoint
UPDATE "game_to_genre" SET genre_id = -genre_id;--> statement-breakpoint
UPDATE "game_to_game_mode" SET game_mode_id = -game_mode_id;--> statement-breakpoint
UPDATE "game_to_type" SET type_id = -type_id;--> statement-breakpoint
UPDATE "website" SET type_id = -type_id WHERE type_id < 0;--> statement-breakpoint
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_platform_id_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platform"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_platform" ADD CONSTRAINT "game_to_platform_platform_id_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platform"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_genre" ADD CONSTRAINT "game_to_genre_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_game_mode" ADD CONSTRAINT "game_to_game_mode_game_mode_id_game_mode_id_fk" FOREIGN KEY ("game_mode_id") REFERENCES "public"."game_mode"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_type" ADD CONSTRAINT "game_to_type_type_id_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website" ADD CONSTRAINT "website_type_id_website_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."website_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
DROP TABLE igdb_lookup_map;--> statement-breakpoint
-- Existing rows get a search key now; the librarian maintains it from here on
UPDATE "game" SET search_names = name WHERE search_names IS NULL;
