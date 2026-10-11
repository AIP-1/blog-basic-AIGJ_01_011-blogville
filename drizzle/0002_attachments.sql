CREATE TABLE "attachments" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"post_id" integer,
	"detached_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attachments_key_check" CHECK ("attachments"."key" ~ '^[0-9a-f]{32}$'),
	CONSTRAINT "attachments_kind_check" CHECK ("attachments"."kind" in ('image', 'file')),
	CONSTRAINT "attachments_name_check" CHECK (char_length("attachments"."name") between 1 and 255),
	CONSTRAINT "attachments_size_check" CHECK ("attachments"."size" > 0)
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_user_created_idx" ON "attachments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "attachments_post_id_idx" ON "attachments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "attachments_unlinked_idx" ON "attachments" USING btree ("created_at") WHERE "attachments"."post_id" is null;