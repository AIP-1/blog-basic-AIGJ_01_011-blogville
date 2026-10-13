CREATE TABLE "admin_audit" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "admin_audit_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"admin_id" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"target_label" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_audit_action_check" CHECK (char_length("admin_audit"."action") between 1 and 40),
	CONSTRAINT "admin_audit_target_type_check" CHECK ("admin_audit"."target_type" in ('member', 'post', 'comment', 'reply', 'guestbook', 'feedback', 'site')),
	CONSTRAINT "admin_audit_target_id_check" CHECK ("admin_audit"."target_id" is null or char_length("admin_audit"."target_id") between 1 and 64),
	CONSTRAINT "admin_audit_target_label_check" CHECK (char_length("admin_audit"."target_label") between 1 and 200),
	CONSTRAINT "admin_audit_detail_check" CHECK ("admin_audit"."detail" is null or char_length("admin_audit"."detail") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_value_check" CHECK (char_length("site_settings"."value") <= 10000)
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "blinded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "blind_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspend_reason" text;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_audit_action_created_idx" ON "admin_audit" USING btree ("action","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_blinded_private" CHECK ("posts"."blinded_at" is null or not "posts"."is_public");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_blind_reason_check" CHECK ("posts"."blind_reason" is null or char_length("posts"."blind_reason") between 1 and 200);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_suspend_reason_check" CHECK ("users"."suspend_reason" is null or char_length("users"."suspend_reason") between 1 and 200);