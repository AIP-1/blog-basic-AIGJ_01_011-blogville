CREATE TABLE "notification_prefs" (
	"user_id" text PRIMARY KEY NOT NULL,
	"like" boolean DEFAULT true NOT NULL,
	"comment" boolean DEFAULT true NOT NULL,
	"reply" boolean DEFAULT true NOT NULL,
	"guestbook" boolean DEFAULT true NOT NULL,
	"new_post" boolean DEFAULT true NOT NULL,
	"level_up" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_shape_check";--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('like', 'comment', 'reply', 'level_up', 'guestbook', 'guestbook_reply', 'feedback_reply', 'new_post'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shape_check" CHECK (("notifications"."kind" = 'level_up' and "notifications"."actor_id" is null and "notifications"."post_id" is null and "notifications"."guestbook_entry_id" is null and "notifications"."feedback_id" is null and "notifications"."level" between 2 and 99) or ("notifications"."kind" in ('like', 'comment', 'reply', 'new_post') and "notifications"."actor_id" is not null and "notifications"."post_id" is not null and "notifications"."guestbook_entry_id" is null and "notifications"."feedback_id" is null and "notifications"."level" is null) or ("notifications"."kind" in ('guestbook', 'guestbook_reply') and "notifications"."actor_id" is not null and "notifications"."post_id" is null and "notifications"."guestbook_entry_id" is not null and "notifications"."feedback_id" is null and "notifications"."level" is null) or ("notifications"."kind" = 'feedback_reply' and "notifications"."actor_id" is null and "notifications"."post_id" is null and "notifications"."guestbook_entry_id" is null and "notifications"."feedback_id" is not null and "notifications"."level" is null));