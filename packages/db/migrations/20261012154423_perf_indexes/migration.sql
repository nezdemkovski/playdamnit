DROP INDEX "idx_game_slug";--> statement-breakpoint
DROP INDEX "idx_game_rating";--> statement-breakpoint
DROP INDEX "idx_user_games_game_id";--> statement-breakpoint
CREATE INDEX "idx_game_popular_order" ON "game" ("is_popular" DESC,"total_rating_count" DESC NULLS LAST,"hypes" DESC NULLS LAST,"id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_game_release_order" ON "game" ("first_release_date" DESC,"total_rating_count" DESC NULLS LAST) WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_game_rating_order" ON "game" ("total_rating" DESC NULLS LAST,"total_rating_count" DESC NULLS LAST) WHERE "deleted_at" is null and "total_rating_count" >= 50;--> statement-breakpoint
CREATE INDEX "idx_game_rating_count_order" ON "game" ("total_rating_count" DESC NULLS LAST,"id") WHERE "deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_notification_unread_user_id" ON "notification" ("user_id") WHERE "read_at" is null;--> statement-breakpoint
CREATE INDEX "idx_user_games_game_id_status" ON "user_games" ("game_id","status");--> statement-breakpoint
CREATE INDEX "idx_user_games_user_id_updated_at" ON "user_games" ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_user_games_reviews_updated_at" ON "user_games" ("updated_at" DESC NULLS LAST) WHERE "review" is not null;--> statement-breakpoint
CREATE INDEX "idx_user_games_reviews_game_id_updated_at" ON "user_games" ("game_id","updated_at" DESC NULLS LAST) WHERE "review" is not null;