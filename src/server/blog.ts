import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { blogs, profiles } from "@/db/schema";
import { BLOG_ERRORS } from "@/lib/blog-rules";
import { isReserved, normalizeName, SLUG_RE } from "@/lib/names";
import { findNameConflict, isUniqueViolation, lockName } from "./names";

/** 주소로 블로그와 주인 닉네임. 주소는 들어온 그대로 비교한다 (대문자 주소는 없음 → 404, BLOG-02). */
export async function getBlogBySlug(slug: string) {
  const [row] = await db
    .select({ blog: blogs, nickname: profiles.nickname })
    .from(blogs)
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(eq(blogs.slug, slug))
    .limit(1);
  return row ?? null;
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

/** 블로그 주소 바꾸기 (BLOG-03). 성공하면 { oldSlug, slug }, 아니면 오류 문구. */
export async function updateBlogSlug(ownerId: string, rawSlug: string) {
  const slug = normalizeName(rawSlug);
  if (!SLUG_RE.test(slug)) return { error: BLOG_ERRORS.slugFormat } as const;
  if (isReserved(slug)) return { error: BLOG_ERRORS.slugReserved } as const;
  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx.select({ slug: blogs.slug }).from(blogs).where(eq(blogs.ownerId, ownerId));
      if (current.slug === slug) return { oldSlug: slug, slug } as const;
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
