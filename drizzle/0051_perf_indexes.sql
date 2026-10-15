DROP INDEX "admin_audit_created_idx";--> statement-breakpoint
DROP INDEX "admin_audit_action_created_idx";--> statement-breakpoint
DROP INDEX "bookmarks_user_created_idx";--> statement-breakpoint
DROP INDEX "error_logs_last_seen_idx";--> statement-breakpoint
DROP INDEX "feedback_user_created_idx";--> statement-breakpoint
DROP INDEX "food_saved_user_created_idx";--> statement-breakpoint
DROP INDEX "guestbook_entries_blog_created_idx";--> statement-breakpoint
DROP INDEX "notifications_user_created_idx";--> statement-breakpoint
DROP INDEX "point_ledger_user_created_idx";--> statement-breakpoint
DROP INDEX "posts_blog_list_idx";--> statement-breakpoint
DROP INDEX "posts_blog_popular_idx";--> statement-breakpoint
CREATE INDEX "comments_created_idx" ON "comments" USING btree ("created_at") WHERE "comments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "post_likes_created_idx" ON "post_likes" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "posts_recent_idx" ON "posts" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "admin_audit_action_created_idx" ON "admin_audit" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "bookmarks_user_created_idx" ON "bookmarks" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "error_logs_last_seen_idx" ON "error_logs" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "feedback_user_created_idx" ON "feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "food_saved_user_created_idx" ON "food_saved" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "guestbook_entries_blog_created_idx" ON "guestbook_entries" USING btree ("blog_id","created_at","id");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "point_ledger_user_created_idx" ON "point_ledger" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "posts_blog_list_idx" ON "posts" USING btree ("blog_id","created_at","id");--> statement-breakpoint
CREATE INDEX "posts_blog_popular_idx" ON "posts" USING btree ("blog_id","view_count");