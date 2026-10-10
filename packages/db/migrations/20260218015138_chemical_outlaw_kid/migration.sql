CREATE TABLE "cover" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cover_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" integer NOT NULL,
	"hash" text NOT NULL,
	"source" text DEFAULT 'igdb' NOT NULL,
	"width" integer,
	"height" integer,
	CONSTRAINT "cover_game_id_unique" UNIQUE("game_id")
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"storyline" text,
	"first_release_date" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"total_rating" real,
	"involved_companies" text,
	"keywords" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_popular" boolean DEFAULT false NOT NULL,
	CONSTRAINT "game_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "game_mode" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "game_mode_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "game_mode_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "game_to_game_mode" (
	"game_id" integer NOT NULL,
	"game_mode_id" integer NOT NULL,
	CONSTRAINT "game_to_game_mode_game_id_game_mode_id_pk" PRIMARY KEY("game_id","game_mode_id")
);
--> statement-breakpoint
CREATE TABLE "game_to_genre" (
	"game_id" integer NOT NULL,
	"genre_id" integer NOT NULL,
	CONSTRAINT "game_to_genre_game_id_genre_id_pk" PRIMARY KEY("game_id","genre_id")
);
--> statement-breakpoint
CREATE TABLE "game_to_platform" (
	"game_id" integer NOT NULL,
	"platform_id" integer NOT NULL,
	CONSTRAINT "game_to_platform_game_id_platform_id_pk" PRIMARY KEY("game_id","platform_id")
);
--> statement-breakpoint
CREATE TABLE "game_to_similar_game" (
	"game_id" integer NOT NULL,
	"similar_game_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_to_similar_game_game_id_similar_game_id_pk" PRIMARY KEY("game_id","similar_game_id")
);
--> statement-breakpoint
CREATE TABLE "game_to_type" (
	"game_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	CONSTRAINT "game_to_type_game_id_type_id_pk" PRIMARY KEY("game_id","type_id")
);
--> statement-breakpoint
CREATE TABLE "genre" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "genre_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "genre_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "platform" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "platform_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "platform_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "screenshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "screenshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" integer NOT NULL,
	"hash" text NOT NULL,
	"source" text DEFAULT 'igdb' NOT NULL,
	"width" integer,
	"height" integer
);
--> statement-breakpoint
CREATE TABLE "type" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "type_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	CONSTRAINT "type_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "website" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "website_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"game_id" integer NOT NULL,
	"url" text NOT NULL,
	"trusted" boolean,
	"type_id" integer
);
--> statement-breakpoint
CREATE TABLE "website_type" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "website_type_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	CONSTRAINT "website_type_type_unique" UNIQUE("type")
);
--> statement-breakpoint
ALTER TABLE "cover" ADD CONSTRAINT "cover_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_game_mode" ADD CONSTRAINT "game_to_game_mode_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_game_mode" ADD CONSTRAINT "game_to_game_mode_game_mode_id_game_mode_id_fk" FOREIGN KEY ("game_mode_id") REFERENCES "public"."game_mode"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_genre" ADD CONSTRAINT "game_to_genre_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_genre" ADD CONSTRAINT "game_to_genre_genre_id_genre_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genre"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_platform" ADD CONSTRAINT "game_to_platform_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_platform" ADD CONSTRAINT "game_to_platform_platform_id_platform_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platform"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_similar_game" ADD CONSTRAINT "game_to_similar_game_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_similar_game" ADD CONSTRAINT "game_to_similar_game_similar_game_id_game_id_fk" FOREIGN KEY ("similar_game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_type" ADD CONSTRAINT "game_to_type_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_to_type" ADD CONSTRAINT "game_to_type_type_id_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screenshot" ADD CONSTRAINT "screenshot_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website" ADD CONSTRAINT "website_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website" ADD CONSTRAINT "website_type_id_website_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."website_type"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_cover_game_id" ON "cover" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_name" ON "game" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_game_slug" ON "game" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_game_popular" ON "game" USING btree ("is_popular");--> statement-breakpoint
CREATE INDEX "idx_game_rating" ON "game" USING btree ("total_rating");--> statement-breakpoint
CREATE INDEX "idx_game_mode_slug" ON "game_mode" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_g2gm_game_id" ON "game_to_game_mode" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2gm_game_mode_id" ON "game_to_game_mode" USING btree ("game_mode_id");--> statement-breakpoint
CREATE INDEX "idx_g2g_game_id" ON "game_to_genre" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2g_genre_id" ON "game_to_genre" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "idx_g2p_game_id" ON "game_to_platform" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2p_platform_id" ON "game_to_platform" USING btree ("platform_id");--> statement-breakpoint
CREATE INDEX "idx_g2sg_game_id" ON "game_to_similar_game" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2sg_similar_game_id" ON "game_to_similar_game" USING btree ("similar_game_id");--> statement-breakpoint
CREATE INDEX "idx_g2t_game_id" ON "game_to_type" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_g2t_type_id" ON "game_to_type" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "idx_genre_slug" ON "genre" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_platform_slug" ON "platform" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_screenshot_game_id" ON "screenshot" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_type_type" ON "type" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_website_game_id" ON "website" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "idx_website_type_id" ON "website" USING btree ("type_id");--> statement-breakpoint
CREATE INDEX "idx_website_type_type" ON "website_type" USING btree ("type");