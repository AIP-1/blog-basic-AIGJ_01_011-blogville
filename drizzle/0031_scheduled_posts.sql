ALTER TABLE "posts" ADD COLUMN "publish_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "posts_publish_at_idx" ON "posts" USING btree ("publish_at") WHERE "posts"."publish_at" is not null;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_scheduled_private" CHECK ("posts"."publish_at" is null or not "posts"."is_public");