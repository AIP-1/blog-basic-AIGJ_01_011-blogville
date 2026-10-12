import "server-only";
import { and, count, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { likePattern } from "@/lib/blog-search";
import { blogs, categories, follows, posts, profiles, subcategories } from "@/db/schema";
import { commentCountSql } from "./comments";
import { likeCountSql } from "./likes";
import { PAGE_SIZE } from "./post";

/**
 * 마을 소식(SOC-05)·이웃 새 글(SOC-04): 모든 블로그(또는 내 이웃 블로그)의 공개 글, 최신순 8개씩.
 * 마을 검색(BLOG-07)은 `search`로 제목·본문에 그 말이 든 글만 거른다.
 * 주인이나 관리자가 봐도 비공개 글은 나오지 않는다.
 */
export async function listFeed({ page, followerId, search }: { page: number; followerId?: string; search?: string }) {
  const conditions: SQL[] = [eq(posts.isPublic, true)];
  if (search) {
    conditions.push(or(ilike(posts.title, likePattern(search)), ilike(posts.contentText, likePattern(search)))!);
  }
  if (followerId) {
    const mine = db.select({ id: follows.followeeId }).from(follows).where(eq(follows.followerId, followerId));
    conditions.push(inArray(blogs.ownerId, mine));
  }
  const where = and(...conditions);
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        post: posts,
        commentCount: commentCountSql(posts.id),
        likeCount: likeCountSql(posts.id),
        categoryName: categories.name,
        subcategoryName: subcategories.name,
        blogSlug: blogs.slug,
        blogTitle: blogs.title,
        nickname: profiles.nickname,
      })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
      .where(where)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(posts).innerJoin(blogs, eq(blogs.id, posts.blogId)).where(where),
  ]);
  return { items, total };
}
