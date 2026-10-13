-- 글의 대분류는 같은 블로그 것만, 소분류는 그 대분류 것만 (BLOG-05, POST-03).
-- 대분류를 지우면 category_id만, 소분류를 지우면 subcategory_id만 비운다.
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_blog_fk"
  FOREIGN KEY ("category_id", "blog_id") REFERENCES "categories"("id", "blog_id")
  ON DELETE SET NULL ("category_id");
--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_subcategory_category_fk"
  FOREIGN KEY ("subcategory_id", "category_id") REFERENCES "subcategories"("id", "category_id")
  ON DELETE SET NULL ("subcategory_id");
