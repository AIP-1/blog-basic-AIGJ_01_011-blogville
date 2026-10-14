ALTER TABLE "blog_stocks" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- 지금까지는 넣은 순서로 보였다: 그 순서를 그대로 번호로
UPDATE "blog_stocks" s SET "position" = r.n FROM (
  SELECT "id", row_number() OVER (PARTITION BY "blog_id" ORDER BY "created_at", "id") - 1 AS n FROM "blog_stocks"
) r WHERE s."id" = r."id";
