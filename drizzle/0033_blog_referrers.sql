CREATE TABLE "blog_referrers" (
	"blog_id" integer NOT NULL,
	"date" date NOT NULL,
	"source" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "blog_referrers_blog_id_date_source_pk" PRIMARY KEY("blog_id","date","source"),
	CONSTRAINT "blog_referrers_source_check" CHECK (char_length("blog_referrers"."source") between 1 and 60),
	CONSTRAINT "blog_referrers_count_check" CHECK ("blog_referrers"."count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "blog_referrers" ADD CONSTRAINT "blog_referrers_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;