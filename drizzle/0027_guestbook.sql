CREATE TABLE "guestbook_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "guestbook_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"blog_id" integer NOT NULL,
	"author_id" text NOT NULL,
	"content" text NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"reply" text,
	"replied_at" timestamp with time zone,
	"reply_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guestbook_entries_content_check" CHECK (char_length("guestbook_entries"."content") between 1 and 1000),
	CONSTRAINT "guestbook_entries_reply_check" CHECK (("guestbook_entries"."reply" is null and "guestbook_entries"."replied_at" is null and "guestbook_entries"."reply_edited_at" is null) or ("guestbook_entries"."reply" is not null and char_length("guestbook_entries"."reply") between 1 and 1000 and "guestbook_entries"."replied_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_shape_check";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "guestbook_entry_id" integer;--> statement-breakpoint
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guestbook_entries_blog_created_idx" ON "guestbook_entries" USING btree ("blog_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "guestbook_entries_author_idx" ON "guestbook_entries" USING btree ("author_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_guestbook_entry_id_guestbook_entries_id_fk" FOREIGN KEY ("guestbook_entry_id") REFERENCES "public"."guestbook_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_guestbook_entry_idx" ON "notifications" USING btree ("guestbook_entry_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('like', 'comment', 'reply', 'level_up', 'guestbook', 'guestbook_reply'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shape_check" CHECK (("notifications"."kind" = 'level_up' and "notifications"."actor_id" is null and "notifications"."post_id" is null and "notifications"."guestbook_entry_id" is null and "notifications"."level" between 2 and 99) or ("notifications"."kind" in ('like', 'comment', 'reply') and "notifications"."actor_id" is not null and "notifications"."post_id" is not null and "notifications"."guestbook_entry_id" is null and "notifications"."level" is null) or ("notifications"."kind" in ('guestbook', 'guestbook_reply') and "notifications"."actor_id" is not null and "notifications"."post_id" is null and "notifications"."guestbook_entry_id" is not null and "notifications"."level" is null));