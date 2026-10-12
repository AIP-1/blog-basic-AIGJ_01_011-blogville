import "server-only";
import { desc, eq, ilike, max, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { blogs, posts, profiles } from "@/db/schema";
import { likePattern } from "@/lib/blog-search";
import { BLOG_ERRORS } from "@/lib/blog-rules";
import { mayUseSlug, normalizeName, SLUG_RE } from "@/lib/names";
import { findNameConflict, isUniqueViolation, lockName } from "./names";

/** 주소로 블로그와 주인 닉네임. 주소는 들어온 그대로 비교한다 (대문자 주소는 없음 → 404, BLOG-02). */
export async function getBlogBySlug(slug: string) {
  const [row] = await db
    .select({ blog: blogs, nickname: profiles.nickname, photoKey: profiles.photoKey })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(eq(blogs.slug, slug))
    .limit(1);
  return row ?? null;
}

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
