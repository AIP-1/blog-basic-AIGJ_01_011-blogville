import "server-only";
import { and, desc, eq, ilike, isNull, max, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db, type Tx } from "@/db";
import { alias } from "drizzle-orm/pg-core";
import { attachments, blogs, items, posts, profiles } from "@/db/schema";
import { likePattern } from "@/lib/blog-search";
import { DEFAULT_ACCENT, type BlogAccent } from "@/lib/blog-accent";
import { DEFAULT_LIST_STYLE, type ListStyle } from "@/lib/list-style";
import { BLOG_ERRORS } from "@/lib/blog-rules";
import { mayUseSlug, normalizeName, SLUG_RE } from "@/lib/names";
import { findNameConflict, isUniqueViolation, lockName } from "./names";

const backgroundItems = alias(items, "background_items");

/** 주소로 블로그와 주인 닉네임·캐릭터·미니룸 배경. 주소는 들어온 그대로 비교한다 (대문자 주소는 없음 → 404, BLOG-02). 한 요청 안에서는 한 번만 읽는다. */
export const getBlogBySlug = cache(async (slug: string) => {
  const [row] = await db
    .select({ blog: blogs, nickname: profiles.nickname, photoKey: profiles.photoKey, characterArt: items.art, backgroundArt: backgroundItems.art })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .leftJoin(items, eq(items.id, profiles.characterItemId))
    .leftJoin(backgroundItems, eq(backgroundItems.id, blogs.backgroundItemId))
    .where(eq(blogs.slug, slug))
    .limit(1);
  return row ?? null;
});

/**
 * 마을 검색(BLOG-07): 블로그 이름이나 주인 닉네임에 그 말이 든 블로그.
 * 최근 공개 글이 있는 블로그가 먼저(글이 없으면 뒤), 그다음 만든 순서.
 */
export async function searchBlogs(term: string, limit = 8) {
  const pattern = likePattern(term);
  const lastPost = db
    .select({ blogId: posts.blogId, at: max(posts.createdAt).as("last_post_at") })
    .from(posts)
    .where(eq(posts.isPublic, true))
    .groupBy(posts.blogId)
    .as("last_post");
  return db
    .select({ slug: blogs.slug, title: blogs.title, nickname: profiles.nickname })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .leftJoin(lastPost, eq(lastPost.blogId, blogs.id))
    .where(or(ilike(blogs.title, pattern), ilike(profiles.nickname, pattern)))
    .orderBy(sql`${lastPost.at} desc nulls last`, desc(blogs.createdAt), desc(blogs.id))
    .limit(limit);
}

/** 같은 블로그의 카테고리 변경을 줄 세운다 (BLOG-05) */
export async function lockBlog(tx: Tx, blogId: number) {
  await tx.execute(sql`select id from blogs where id = ${blogId} for update`);
}

export async function updateBlogInfo(ownerId: string, input: { title: string; intro: string }) {
  await db
    .update(blogs)
    .set({ title: input.title.trim(), intro: input.intro.trim() })
    .where(eq(blogs.ownerId, ownerId));
}

/**
 * 블로그 주소 바꾸기 (BLOG-03). 성공하면 { oldSlug, slug }, 아니면 오류 문구.
 * 지금과 같은 주소는 예약어여도 그대로 성공한다 (공지 블로그 `notice`를 가진 관리자가 [주소 바꾸기]를 그대로 눌러도).
 */
export async function updateBlogSlug(ownerId: string, rawSlug: string, role: string) {
  const slug = normalizeName(rawSlug);
  if (!SLUG_RE.test(slug)) return { error: BLOG_ERRORS.slugFormat } as const;
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select({ slug: blogs.slug }).from(blogs).where(eq(blogs.ownerId, ownerId));
      if (current.slug === slug) return { oldSlug: slug, slug } as const;
      if (!mayUseSlug(slug, role)) return { error: BLOG_ERRORS.slugReserved } as const;
      await lockName(tx, slug);
      // 주소는 닉네임과 같아도 된다
      if (await findNameConflict(tx, slug, { exceptUserId: ownerId, checkNicknames: false })) {
        return { error: BLOG_ERRORS.slugTaken } as const;
      }
      await tx.update(blogs).set({ slug }).where(eq(blogs.ownerId, ownerId));
      return { oldSlug: current.slug, slug } as const;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: BLOG_ERRORS.slugTaken } as const;
    throw e;
  }
}

/** 블로그 강조색 바꾸기 (블로그 꾸미기). 기본 초록이면 NULL로 */
export async function updateBlogAccent(ownerId: string, accent: BlogAccent) {
  await db
    .update(blogs)
    .set({ accentColor: accent === DEFAULT_ACCENT ? null : accent })
    .where(eq(blogs.ownerId, ownerId));
}

/** 글 목록 모양 바꾸기 (블로그 꾸미기). 기본 카드형이면 NULL로 */
export async function updateBlogListStyle(ownerId: string, style: ListStyle) {
  await db
    .update(blogs)
    .set({ listStyle: style === DEFAULT_LIST_STYLE ? null : style })
    .where(eq(blogs.ownerId, ownerId));
}

export const COVER_ERRORS = {
  invalid: "이 사진은 커버 사진으로 쓸 수 없어요. 다시 올려 주세요.",
  saved: "커버 사진을 바꿨어요",
  removed: "커버 사진을 지웠어요",
} as const;

/**
 * 블로그 커버 사진 바꾸기: 프로필 사진(setProfilePhoto)과 같은 규칙. 내가 방금(1시간 안) 올렸고 어느 글에도 붙지 않은 사진만 받는다.
 * 블로그 → 첨부 순서로 잠근다. 전 사진은 떨어진 첨부가 되어 하루 뒤 정리 작업이 지운다.
 */
export async function setBlogCover(ownerId: string, key: string): Promise<string | null> {
  return db.transaction(async (tx) => {
    const [blog] = await tx.select({ id: blogs.id, key: blogs.coverKey }).from(blogs).where(eq(blogs.ownerId, ownerId)).for("update");
    if (!blog) return COVER_ERRORS.invalid;
    if (blog.key === key) return null;
    const [photo] = await tx
      .select({ key: attachments.key })
      .from(attachments)
      .where(
        and(
          eq(attachments.key, key),
          eq(attachments.userId, ownerId),
          eq(attachments.kind, "image"),
          isNull(attachments.postId),
          sql`${attachments.createdAt} > now() - interval '1 hour'`,
        ),
      )
      .for("update");
    if (!photo) return COVER_ERRORS.invalid;
    await tx.update(blogs).set({ coverKey: key }).where(eq(blogs.id, blog.id));
    if (blog.key) await tx.update(attachments).set({ detachedAt: sql`now()` }).where(eq(attachments.key, blog.key));
    return null;
  });
}

/** 커버 사진 지우기: 비우고, 그 첨부는 하루 뒤 정리 작업이 지운다 */
export async function removeBlogCover(ownerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [blog] = await tx.select({ id: blogs.id, key: blogs.coverKey }).from(blogs).where(eq(blogs.ownerId, ownerId)).for("update");
    if (!blog?.key) return;
    await tx.update(blogs).set({ coverKey: null }).where(eq(blogs.id, blog.id));
    await tx.update(attachments).set({ detachedAt: sql`now()` }).where(eq(attachments.key, blog.key));
  });
}
