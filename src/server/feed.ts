import "server-only";
import { and, count, desc, eq, ilike, inArray, max, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { likePattern } from "@/lib/blog-search";
import { favoriteWindowStart } from "@/lib/social";
import { blogs, categories, follows, posts, profiles, subcategories } from "@/db/schema";
import { commentCountSql } from "./comments";
import { likeCountSql } from "./likes";
import { PAGE_SIZE } from "./post";

/**
 * 마을 소식(SOC-05)·이웃 새 글(SOC-04): 모든 블로그(또는 내 이웃 블로그)의 공개 글, 최신순 8개씩.
 * 마을 검색(BLOG-07)은 `search`로 제목·본문에 그 말이 든 글만 거른다.
 * 주인이나 관리자가 봐도 비공개 글은 나오지 않는다.
 * 이웃 새 글은 즐겨찾는 이웃(⭐, TOWN-08)이 최근 7일(한국 날짜, 오늘 포함) 안에 쓴 글을 맨 위로 올리고 `pinned`로 표시한다.
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
  const pinned: SQL<boolean> = followerId
    ? sql<boolean>`(${posts.createdAt} >= ${favoriteWindowStart().toISOString()}::timestamptz and exists (
        select 1 from ${follows} fav
        where fav.follower_id = ${followerId} and fav.followee_id = ${blogs.ownerId} and fav.is_favorite))`
    : sql<boolean>`false`;
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
        pinned,
      })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
      .where(where)
      .orderBy(...(followerId ? [desc(pinned)] : []), desc(posts.createdAt), desc(posts.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(posts).innerJoin(blogs, eq(blogs.id, posts.blogId)).where(where),
  ]);
  return { items, total };
}

export const BROWSE_BLOGS = 12;

/**
 * 마을 소식 1페이지의 `블로그 둘러보기` (SOC-05 열린 질문의 제안): 공개 글이 있는 블로그를 최근 공개 글 순으로.
 * 글 수도 공개 글만 센다.
 */
export async function listActiveBlogs(limit = BROWSE_BLOGS) {
  const active = db
    .select({ blogId: posts.blogId, lastAt: max(posts.createdAt).as("last_at"), postCount: count().as("post_count") })
    .from(posts)
    .where(eq(posts.isPublic, true))
    .groupBy(posts.blogId)
    .as("active");
  return db
    .select({ slug: blogs.slug, title: blogs.title, nickname: profiles.nickname, postCount: active.postCount })
    .from(active)
    .innerJoin(blogs, eq(blogs.id, active.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .orderBy(desc(active.lastAt), desc(blogs.id))
    .limit(limit);
}
