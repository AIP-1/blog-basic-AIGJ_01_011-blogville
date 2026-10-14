CREATE TABLE "blog_stocks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "blog_stocks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"blog_id" integer NOT NULL,
	"market" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blog_stocks_market_check" CHECK ("blog_stocks"."market" in ('KR', 'US')),
	CONSTRAINT "blog_stocks_name_check" CHECK (char_length("blog_stocks"."name") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "blog_stocks" ADD CONSTRAINT "blog_stocks_blog_id_blogs_id_fk" FOREIGN KEY ("blog_id") REFERENCES "public"."blogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_stocks_blog_code_uq" ON "blog_stocks" USING btree ("blog_id","market","code");