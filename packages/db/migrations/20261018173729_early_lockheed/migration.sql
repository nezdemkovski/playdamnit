CREATE TABLE "content_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"reporter_id" text,
	"subject_id" text,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"context" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	CONSTRAINT "content_report_once" UNIQUE("reporter_id","kind","target_id")
);
--> statement-breakpoint
CREATE TABLE "user_block" (
	"blocker_id" text,
	"blocked_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_block_pkey" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "user_block_not_self" CHECK ("blocker_id" <> "blocked_id")
);
--> statement-breakpoint
CREATE INDEX "content_report_queue_idx" ON "content_report" ("status","created_at");--> statement-breakpoint
CREATE INDEX "content_report_subject_idx" ON "content_report" ("subject_id");--> statement-breakpoint
CREATE INDEX "content_report_resolved_by_idx" ON "content_report" ("resolved_by");--> statement-breakpoint
CREATE INDEX "user_block_blocked_idx" ON "user_block" ("blocked_id");--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_reporter_id_user_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_subject_id_user_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "content_report" ADD CONSTRAINT "content_report_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blocker_id_user_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blocked_id_user_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "user"("id") ON DELETE CASCADE;