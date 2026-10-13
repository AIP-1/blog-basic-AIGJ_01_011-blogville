CREATE TABLE "series" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "series_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"blog_id" integer NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_blog_title_unique" UNIQUE("blog_id","title"),
	CONSTRAINT "series_title_check" CHECK (char_length("series"."title") between 1 and 40 and "series"."title" = btrim("series"."title"))
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "series_id" integer;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_series_idx" ON "posts" USING btree ("series_id","created_at","id") WHERE "posts"."series_id" is not null;