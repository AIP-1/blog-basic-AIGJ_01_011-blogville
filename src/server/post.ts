import "server-only";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogs, categories, posts, subcategories } from "@/db/schema";
import { POST_ERRORS, type PostInput } from "@/lib/post-rules";
import { htmlToText, sanitizePostHtml } from "@/lib/sanitize";
import { resolveCategory } from "./category";

export const PAGE_SIZE = 8;

export class PostSaveError extends Error {}

/**
 * 글 저장 (POST-01~03). 새 글이면 만들고, postId가 있으면 내 글만 고친다.
 * 남의 글·없는 글을 고치려 하면 예외(오류 화면). 입력 오류는 PostSaveError(문구).
 */
export async function savePost(blogId: number, input: PostInput): Promise<number> {
  const contentHtml = sanitizePostHtml(input.contentHtml);
  const contentText = htmlToText(contentHtml);
  if (contentText.length === 0) throw new PostSaveError(POST_ERRORS.contentEmpty);

  return db.transaction(async (tx) => {
    const category = await resolveCategory(tx, blogId, input.categoryId, input.subcategoryId);
    if (category === "invalid") throw new PostSaveError(POST_ERRORS.invalid);
    const values = { title: input.title, contentHtml, contentText, isPublic: input.isPublic, ...category };

    if (input.postId === null) {
      const [row] = await tx.insert(posts).values({ blogId, ...values }).returning({ id: posts.id });
      return row.id;
    }
    const [row] = await tx
      .update(posts)
      .set(values)
      .where(and(eq(posts.id, input.postId), eq(posts.blogId, blogId)))
      .returning({ id: posts.id });
    if (!row) throw new Error("내 글이 아닌 글을 고치려 함");
    return row.id;
  });
}

/** 내 글이면 지운다. 남의 글·없는 글이면 아무것도 하지 않는다. */
export async function deletePost(blogId: number, postId: number) {
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.blogId, blogId)));
}

const postWithCategory = {
  post: posts,
  categoryName: categories.name,
  subcategoryName: subcategories.name,
};

/** 글 상세. 다른 블로그의 글이거나 남의 비공개 글이면 null (404). */
export async function getPostForView(blogId: number, postId: number, viewerIsOwner: boolean) {
  const [row] = await db
    .select(postWithCategory)
    .from(posts)
    .leftJoin(categories, eq(categories.id, posts.categoryId))
    .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
    .where(and(eq(posts.id, postId), eq(posts.blogId, blogId)))
    .limit(1);
  if (!row || (!row.post.isPublic && !viewerIsOwner)) return null;
  return row;
}

/** 수정 화면용: 그 회원의 블로그 글만 */
export async function getPostForEdit(ownerId: string, postId: number) {
  const [row] = await db
    .select({ post: posts })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .where(and(eq(posts.id, postId), eq(blogs.ownerId, ownerId)))
    .limit(1);
  return row?.post ?? null;
}

/** 블로그 홈 글 목록 (POST-05): 최신순 8개씩. 주인이 아니면 공개 글만. */
export async function listBlogPosts(
  blogId: number,
  opts: { viewerIsOwner: boolean; categoryId?: number | null; subcategoryId?: number | null; page: number },
) {
  const where = and(
    eq(posts.blogId, blogId),
    opts.viewerIsOwner ? undefined : eq(posts.isPublic, true),
    opts.subcategoryId ? eq(posts.subcategoryId, opts.subcategoryId) : opts.categoryId ? eq(posts.categoryId, opts.categoryId) : undefined,
  );
  const [items, [{ total }]] = await Promise.all([
    db
      .select(postWithCategory)
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
      .where(where)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(PAGE_SIZE)
      .offset((opts.page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(posts).where(where),
  ]);
  return { items, total };
}
