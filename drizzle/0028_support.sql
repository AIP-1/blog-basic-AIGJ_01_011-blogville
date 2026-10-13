CREATE TABLE "feedback" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "feedback_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"page_path" text,
	"user_agent" text,
	"status" text DEFAULT 'new' NOT NULL,
	"reply" text,
	"replied_at" timestamp with time zone,
	"replied_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_kind_check" CHECK ("feedback"."kind" in ('bug', 'question')),
	CONSTRAINT "feedback_status_check" CHECK ("feedback"."status" in ('new', 'in_progress', 'answered', 'fixed')),
	CONSTRAINT "feedback_title_check" CHECK (char_length("feedback"."title") between 1 and 100),
	CONSTRAINT "feedback_content_check" CHECK (char_length("feedback"."content") between 1 and 2000),
	CONSTRAINT "feedback_page_path_check" CHECK ("feedback"."page_path" is null or char_length("feedback"."page_path") between 1 and 2048),
	CONSTRAINT "feedback_user_agent_check" CHECK ("feedback"."user_agent" is null or char_length("feedback"."user_agent") between 1 and 300),
	CONSTRAINT "feedback_reply_check" CHECK (("feedback"."reply" is null and "feedback"."replied_at" is null and "feedback"."replied_by" is null) or ("feedback"."reply" is not null and char_length("feedback"."reply") between 1 and 2000 and "feedback"."replied_at" is not null and "feedback"."replied_by" in ('admin', 'bot')))
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_shape_check";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "feedback_id" integer;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_status_created_idx" ON "feedback" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "feedback_user_created_idx" ON "feedback" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_feedback_id_feedback_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedback"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_feedback_idx" ON "notifications" USING btree ("feedback_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('like', 'comment', 'reply', 'level_up', 'guestbook', 'guestbook_reply', 'feedback_reply'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shape_check" CHECK (("notifications"."kind" = 'level_up' and "notifications"."actor_id" is null and "notifications"."post_id" is null and "notifications"."guestbook_entry_id" is null and "notifications"."feedback_id" is null and "notifications"."level" between 2 and 99) or ("notifications"."kind" in ('like', 'comment', 'reply') and "notifications"."actor_id" is not null and "notifications"."post_id" is not null and "notifications"."guestbook_entry_id" is null and "notifications"."feedback_id" is null and "notifications"."level" is null) or ("notifications"."kind" in ('guestbook', 'guestbook_reply') and "notifications"."actor_id" is not null and "notifications"."post_id" is null and "notifications"."guestbook_entry_id" is not null and "notifications"."feedback_id" is null and "notifications"."level" is null) or ("notifications"."kind" = 'feedback_reply' and "notifications"."actor_id" is null and "notifications"."post_id" is null and "notifications"."guestbook_entry_id" is null and "notifications"."feedback_id" is not null and "notifications"."level" is null));