import "server-only";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { blogs, categories, posts, postTags, profiles, subcategories, tags, users } from "@/db/schema";
import { extractFileKeys } from "@/lib/attachments";
import { postEarnsReward } from "@/lib/game";
import { likePattern } from "@/lib/blog-search";
import { POST_ERRORS, type PostInput } from "@/lib/post-rules";
import { htmlToText, sanitizePostHtml } from "@/lib/sanitize";
import { lockLinkable, syncPostAttachments } from "./attachments";
import { commentCountSql } from "./comments";
import { growForPost } from "./farm";
import { grantReward } from "./points";
import { likeCountSql } from "./likes";
import { resolveCategory } from "./category";
import { syncPostTags } from "./tags";

export const PAGE_SIZE = 8;

export class PostSaveError extends Error {}

/**
 * 글 저장 (POST-01~03, 07, 09). 새 글이면 만들고, postId가 있으면 내 글만 고친다.
 * 본문의 첨부 중 이 글에 붙일 수 있는 것만 남겨 붙이고, 빠진 첨부는 떨어뜨린다.
 * 남의 글·없는 글을 고치려 하면 예외(오류 화면). 입력 오류는 PostSaveError(문구).
 */
export async function savePost(blogId: number, ownerId: string, input: PostInput): Promise<number> {
  return db.transaction(async (tx) => {
    if (input.postId !== null) {
      // 남의 글에 첨부를 붙이지 않게 먼저 내 글인지 본다
      const [mine] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(and(eq(posts.id, input.postId), eq(posts.blogId, blogId)))
        .for("update");
      if (!mine) throw new Error("내 글이 아닌 글을 고치려 함");
    }
    // 회원 → 프로필 → 첨부 순서로 잠근다. 회원 행은 보상 원장 외래 키가 나중에 잠그므로 탈퇴(deleteMember: 회원 행 먼저)와 같은 순서로 먼저 잡는다.
    // 프로필은 setProfilePhoto와 같은 순서라 그 사이 프로필 사진이 된 첨부를 본문에 남기지 않는다
    await tx.select({ id: users.id }).from(users).where(eq(users.id, ownerId)).for("key share");
    await tx.select({ id: profiles.userId }).from(profiles).where(eq(profiles.userId, ownerId)).for("share");
    const known = await lockLinkable(tx, ownerId, input.postId, extractFileKeys(input.contentHtml));
    const contentHtml = sanitizePostHtml(input.contentHtml, known);
    const contentText = htmlToText(contentHtml);
    if (contentText.length === 0) throw new PostSaveError(POST_ERRORS.contentEmpty);

    const category = await resolveCategory(tx, blogId, input.categoryId, input.subcategoryId);
    if (category === "invalid") throw new PostSaveError(POST_ERRORS.invalid);
    const values = { title: input.title, contentHtml, contentText, isPublic: input.isPublic, ...category };

    let postId: number;
    if (input.postId === null) {
      const [row] = await tx.insert(posts).values({ blogId, ...values }).returning({ id: posts.id });
      postId = row.id;
    } else {
      await tx.update(posts).set(values).where(eq(posts.id, input.postId));
      postId = input.postId;
    }
    await syncPostAttachments(tx, postId, extractFileKeys(contentHtml));
    // 공개 새 글(본문 100자 이상)이면 글쓰기 보상, 하루 3번까지 (GAME-05). 고친 글은 보상이 없다
    // 받았으면 키우는 동물이 모두 성장 +10 (TOWN-09)
    if (postEarnsReward(input.postId === null, input.isPublic, contentText.length) && (await grantReward(tx, ownerId, "post", String(postId)))) await growForPost(tx, ownerId);
    await syncPostTags(tx, postId, input.tags);
    return postId;
  });
}

/** 내 글이면 지운다. 남의 글·없는 글이면 아무것도 하지 않는다. */
export async function deletePost(blogId: number, postId: number) {
  await db.delete(posts).where(and(eq(posts.id, postId), eq(posts.blogId, blogId)));
}

const postWithCategory = {
  post: posts,
  commentCount: commentCountSql(posts.id),
  likeCount: likeCountSql(posts.id),
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

/**
 * 글 상세 아래 이전 글·다음 글 (POST-05). 블로그 홈 목록과 같은 (created_at, id) 순서.
 * 지금 글의 시각은 DB에서 비교한다(JS Date는 마이크로초를 잃어 자기 자신이 다음 글로 나올 수 있다).
 * 주인이 아니면 공개 글만.
 */
export async function getAdjacentPosts(blogId: number, postId: number, viewerIsOwner: boolean) {
  const current = sql`(select p.created_at, p.id from ${posts} p where p.id = ${postId})`;
  const base = and(eq(posts.blogId, blogId), viewerIsOwner ? undefined : eq(posts.isPublic, true));
  const pick = { id: posts.id, title: posts.title };
  const [[older], [newer]] = await Promise.all([
    db
      .select(pick)
      .from(posts)
      .where(and(base, sql`(${posts.createdAt}, ${posts.id}) < ${current}`))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(1),
    db
      .select(pick)
      .from(posts)
      .where(and(base, sql`(${posts.createdAt}, ${posts.id}) > ${current}`))
      .orderBy(asc(posts.createdAt), asc(posts.id))
      .limit(1),
  ]);
  return { older: older ?? null, newer: newer ?? null };
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

/**
 * 블로그 홈 글 목록 (POST-05): 최신순 8개씩. 주인이 아니면 공개 글만.
 * 검색(`?s=`, 제목·본문)과 태그(`?tag=`)는 카테고리보다 먼저 쓴다 (BLOG-09).
 */
export async function listBlogPosts(
  blogId: number,
  opts: {
    viewerIsOwner: boolean;
    categoryId?: number | null;
    subcategoryId?: number | null;
    search?: string | null;
    tag?: string | null;
    /** 글 관리(BLOG-08): 주인이 공개·비공개만 골라 볼 때 */
    visibility?: "public" | "private" | null;
    pageSize?: number;
    page: number;
  },
) {
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const filter = opts.search
    ? or(ilike(posts.title, likePattern(opts.search)), ilike(posts.contentText, likePattern(opts.search)))
    : opts.tag
      ? inArray(
          posts.id,
          db.select({ postId: postTags.postId }).from(postTags).innerJoin(tags, eq(tags.id, postTags.tagId)).where(eq(tags.name, opts.tag)),
        )
      : opts.subcategoryId
        ? eq(posts.subcategoryId, opts.subcategoryId)
        : opts.categoryId
          ? eq(posts.categoryId, opts.categoryId)
          : undefined;
  const visibility = !opts.viewerIsOwner || opts.visibility === "public" ? eq(posts.isPublic, true) : opts.visibility === "private" ? eq(posts.isPublic, false) : undefined;
  const where = and(eq(posts.blogId, blogId), visibility, filter);
  const [items, [{ total }]] = await Promise.all([
    db
      .select(postWithCategory)
      .from(posts)
      .leftJoin(categories, eq(categories.id, posts.categoryId))
      .leftJoin(subcategories, eq(subcategories.id, posts.subcategoryId))
      .where(where)
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(pageSize)
      .offset((opts.page - 1) * pageSize),
    db.select({ total: count() }).from(posts).where(where),
  ]);
  return { items, total };
}

/** 글 관리 상단 숫자: 내 글 전체·공개·비공개 (BLOG-08) */
export async function countMyPosts(blogId: number) {
  const [row] = await db
    .select({
      all: count(),
      public: sql<number>`count(*) filter (where ${posts.isPublic})::int`,
      private: sql<number>`count(*) filter (where not ${posts.isPublic})::int`,
    })
    .from(posts)
    .where(eq(posts.blogId, blogId));
  return row;
}

/** 내 글이면 공개·비공개를 바꾼다. 글의 수정 시각은 그대로 둔다. 바꿨으면 true. */
export async function setPostVisibility(blogId: number, postId: number, isPublic: boolean): Promise<boolean> {
  const rows = await db
    .update(posts)
    .set({ isPublic, updatedAt: sql`${posts.updatedAt}` })
    .where(and(eq(posts.id, postId), eq(posts.blogId, blogId)))
    .returning({ id: posts.id });
  return rows.length > 0;
}
