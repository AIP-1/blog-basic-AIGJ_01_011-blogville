CREATE TABLE "blog_visits" (
	"blog_id" integer NOT NULL,
	"date" date NOT NULL,
	"visitor_id" uuid NOT NULL,
	CONSTRAINT "blog_visits_blog_id_date_visitor_id_pk" PRIMARY KEY("blog_id","date","visitor_id")
);
--> statement-breakpoint
CREATE TABLE "post_views" (
	"post_id" integer NOT NULL,
	"date" date NOT NULL,
	"visitor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_views_post_id_date_visitor_id_pk" PRIMARY KEY("post_id","date","visitor_id")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_visits" ADD CONSTRAINT "blog_visits_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_views" ADD CONSTRAINT "post_views_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_blog_popular_idx" ON "posts" USING btree ("blog_id","view_count" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_view_count_check" CHECK ("posts"."view_count" >= 0);