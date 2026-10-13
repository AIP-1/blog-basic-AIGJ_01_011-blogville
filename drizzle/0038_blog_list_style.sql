ALTER TABLE "blogs" ADD COLUMN "list_style" text;--> statement-breakpoint
ALTER TABLE "blogs" ADD CONSTRAINT "blogs_list_style_check" CHECK ("blogs"."list_style" in ('list', 'gallery'));