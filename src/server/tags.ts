import "server-only";
import { and, asc, count, desc, eq, inArray, notInArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { blogs, categories, posts, postTags, subcategories, tags } from "@/db/schema";
import { PAGE_SIZE } from "./post";

/** 이 글의 태그를 새 목록에 맞춘다. 글 저장과 같은 트랜잭션에서 부른다 (POST-04). */
export async function syncPostTags(tx: Tx, postId: number, names: string[]) {
  if (names.length === 0) {
    await tx.delete(postTags).where(eq(postTags.postId, postId));
    return;
  }
  await tx
    .insert(tags)
    .values(names.map((name) => ({ name })))
    .onConflictDoNothing({ target: tags.name });
  const rows = await tx.select({ id: tags.id }).from(tags).where(inArray(tags.name, names));
  const ids = rows.map((r) => r.id);
  await tx.delete(postTags).where(and(eq(postTags.postId, postId), notInArray(postTags.tagId, ids)));
  await tx
    .insert(postTags)
    .values(ids.map((tagId) => ({ postId, tagId })))
    .onConflictDoNothing();
}

/** 글의 태그 이름 (이름순) */
export async function getPostTags(postId: number): Promise<string[]> {
  const rows = await db
    .select({ name: tags.name })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(postTags.postId, postId))
    .orderBy(asc(tags.name));
  return rows.map((r) => r.name);
}

/** 태그별 글: 모든 블로그의 공개 글, 최신순 8개씩 */
export async function listTagPosts(name: string, page: number) {
  const tagged = db
    .select({ postId: postTags.postId })
    .from(postTags)
    .innerJoin(tags, eq(tags.id, postTags.tagId))
    .where(eq(tags.name, name));
  const where = and(eq(posts.isPublic, true), inArray(posts.id, tagged));
  const [items, [{ total }]] = await Promise.all([
    db
      .select({
        post: posts,
        categoryName: categories.name,
        subcategoryName: subcategories.name,
        blogSlug: blogs.slug,
        blogTitle: blogs.title,
      })
      .from(posts)
      .innerJoin(blogs, eq(blogs.id, posts.blogId))
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
      .where(where)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(posts).where(where),
  ]);
  return { items, total };
}

export const POPULAR_TAGS_MAX = 30;

/** 인기 태그: 공개 글에 달린 횟수 많은 순 → 이름순, 30개 */
export async function getPopularTags() {
  const uses = count(postTags.postId);
  return db
    .select({ name: tags.name, count: uses })
    .from(tags)
    .innerJoin(postTags, eq(postTags.tagId, tags.id))
    .innerJoin(posts, and(eq(posts.id, postTags.postId), eq(posts.isPublic, true)))
    .groupBy(tags.id)
    .orderBy(desc(uses), asc(tags.name))
    .limit(POPULAR_TAGS_MAX);
}
