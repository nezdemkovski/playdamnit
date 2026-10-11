ALTER TABLE "review_like" RENAME TO "review_reaction";--> statement-breakpoint
DROP INDEX "idx_review_like_user_game_id";--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "emoji" text;--> statement-breakpoint
ALTER TABLE "review_reaction" ADD COLUMN "emoji" text DEFAULT '❤️' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_games" ADD COLUMN "allow_reactions" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_review_reaction_user_game_id" ON "review_reaction" ("user_game_id");--> statement-breakpoint
UPDATE "notification" SET "type" = 'review_reaction', "emoji" = '❤️' WHERE "type" = 'review_like';
