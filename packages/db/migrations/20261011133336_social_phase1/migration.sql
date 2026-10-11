CREATE TABLE "game_like" (
	"user_id" text,
	"game_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_like_pkey" PRIMARY KEY("user_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "game_list" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_list_item" (
	"list_id" uuid,
	"game_id" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"note" text,
	CONSTRAINT "game_list_item_pkey" PRIMARY KEY("list_id","game_id")
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_id" text NOT NULL,
	"game_id" integer,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playthrough" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"user_id" text NOT NULL,
	"game_id" integer NOT NULL,
	"started_at" date,
	"ended_at" date,
	"hours" numeric(6,1),
	"platform_id" integer,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_like" (
	"user_id" text,
	"user_game_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "review_like_pkey" PRIMARY KEY("user_id","user_game_id")
);
--> statement-breakpoint
CREATE TABLE "user_avatar" (
	"user_id" text PRIMARY KEY,
	"content_type" text NOT NULL,
	"data" bytea NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "user_metadata";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "links" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "list_public" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_games" ADD COLUMN "mastered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_games" ADD COLUMN "spoilers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_games" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_game_like_game_id" ON "game_like" ("game_id");--> statement-breakpoint
CREATE INDEX "idx_game_list_user_id" ON "game_list" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_game_list_item_game_id" ON "game_list_item" ("game_id");--> statement-breakpoint
CREATE INDEX "idx_notification_user_id_created_at" ON "notification" ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_playthrough_user_id" ON "playthrough" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_review_like_user_game_id" ON "review_like" ("user_game_id");--> statement-breakpoint
CREATE INDEX "idx_user_games_updated_at" ON "user_games" ("updated_at");--> statement-breakpoint
ALTER TABLE "game_like" ADD CONSTRAINT "game_like_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_like" ADD CONSTRAINT "game_like_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "game_list" ADD CONSTRAINT "game_list_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_list_item" ADD CONSTRAINT "game_list_item_list_id_game_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "game_list"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "game_list_item" ADD CONSTRAINT "game_list_item_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_id_user_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_game_id_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "game"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "playthrough" ADD CONSTRAINT "playthrough_platform_id_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platform"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "playthrough" ADD CONSTRAINT "playthrough_user_game_fk" FOREIGN KEY ("user_id","game_id") REFERENCES "user_games"("user_id","game_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_like" ADD CONSTRAINT "review_like_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "review_like" ADD CONSTRAINT "review_like_user_game_id_user_games_id_fkey" FOREIGN KEY ("user_game_id") REFERENCES "user_games"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_avatar" ADD CONSTRAINT "user_avatar_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;