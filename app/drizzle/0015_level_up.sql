ALTER TABLE "notifications" DROP CONSTRAINT "notifications_kind_check";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_not_self_check";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "actor_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "post_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "level" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_level_up_uq" ON "notifications" USING btree ("user_id","level") WHERE "notifications"."kind" = 'level_up';--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shape_check" CHECK (("notifications"."kind" = 'level_up' and "notifications"."actor_id" is null and "notifications"."post_id" is null and "notifications"."level" between 2 and 99) or ("notifications"."kind" <> 'level_up' and "notifications"."actor_id" is not null and "notifications"."post_id" is not null and "notifications"."level" is null));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('like', 'comment', 'reply', 'level_up'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_not_self_check" CHECK ("notifications"."actor_id" is null or "notifications"."user_id" <> "notifications"."actor_id");