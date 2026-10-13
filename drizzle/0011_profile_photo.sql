ALTER TABLE "profiles" ADD COLUMN "photo_key" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_photo_key_attachments_key_fk" FOREIGN KEY ("photo_key") REFERENCES "public"."attachments"("key") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_photo_key_unique" UNIQUE("photo_key");