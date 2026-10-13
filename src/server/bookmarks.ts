import "server-only";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, bookmarks, categories, posts, profiles, subcategories } from "@/db/schema";
import { BOOKMARK_PAGE_SIZE } from "@/lib/report-rules";
import { commentCountSql } from "./comments";
import { likeCountSql } from "./likes";

// 스크랩 (나중에 읽기, specs/059-report-bookmarks). 회원은 로그인 세션으로만 정한다: 폼에서는 글 ID만 받는다.

/** 글 상세: 스크랩 수와 내가 스크랩했는지 */
export async function getBookmarkState(postId: number, viewerId: string | null) {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      bookmarked: sql<boolean>`coalesce(bool_or(${bookmarks.userId} = ${viewerId ?? ""}), false)`,
    })
    .from(bookmarks)
    .where(eq(bookmarks.postId, postId));
  return row;
}

/**
 * 스크랩·취소. 서버가 지금 상태를 보고 정한다: 내 스크랩이 있으면 지우고, 없으면 넣는다.
 * 새로 넣는 것은 공개 글만 (남의·내 비공개 글은 스크랩하지 않는다). 글 행을 잠가 그사이 비공개로 바뀌지 않게 한다.
 * 바꿨으면 지금 스크랩했는지, 볼 수 없는 글이면 null.
 */
export async function toggleBookmark(userId: string, postId: number): Promise<boolean | null> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(bookmarks)
      .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
      .returning({ postId: bookmarks.postId });
    if (removed.length > 0) return false;
    const [post] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.id, postId), eq(posts.isPublic, true)))
      .for("key share");
    if (!post) return null;
    await tx.insert(bookmarks).values({ userId, postId }).onConflictDoNothing();
    return true;
  });
}

/** 목록에서 지우기. 지웠으면 true */
export async function removeBookmark(userId: string, postId: number): Promise<boolean> {
  const rows = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.userId, userId), eq(bookmarks.postId, postId)))
    .returning({ postId: bookmarks.postId });
  return rows.length > 0;
}

/**
 * 🔖 내 스크랩: 스크랩한 최신순으로 한 쪽. 지금 공개된 글만 (비공개가 되면 목록에서 빠진다, 다시 공개되면 돌아온다).
 */
export async function listBookmarks(userId: string, page: number) {
  const visible = and(eq(bookmarks.userId, userId), eq(posts.isPublic, true));
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        post: posts,
        slug: blogs.slug,
        blogTitle: blogs.title,
        nickname: profiles.nickname,
        categoryName: categories.name,
        subcategoryName: subcategories.name,
        bookmarkedAt: bookmarks.createdAt,
        likeCount: likeCountSql(posts.id),
        commentCount: commentCountSql(posts.id),
      })
      .from(bookmarks)
      .innerJoin(posts, eq(posts.id, bookmarks.postId))
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .leftJoin(profiles, eq(profiles.userId, blogs.ownerId))
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
      .where(visible)
      .orderBy(desc(bookmarks.createdAt), desc(bookmarks.postId))
      .limit(BOOKMARK_PAGE_SIZE)
      .offset((page - 1) * BOOKMARK_PAGE_SIZE),
    db.select({ total: count() }).from(bookmarks).innerJoin(posts, eq(posts.id, bookmarks.postId)).where(visible),
  ]);
  return { items: rows, total };
}
