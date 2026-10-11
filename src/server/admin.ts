import "server-only";
import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, blogs, comments, posts, profiles, replies, users } from "@/db/schema";

export const RECENT_MEMBERS = 20;
export const RECENT_POSTS = 30;
export const RECENT_POST_DAYS = 30;

/** 통계 카드: 가입 계정 · 전체 글 · 댓글(삭제 안 된 댓글 + 답글) · 오늘 새 글(한국 시간 0시 이후) */
export async function getAdminStats() {
  const todayStart = sql`(date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`;
  const [[m], [p], [c], [r], [t]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(posts),
    db.select({ n: count() }).from(comments).where(isNull(comments.deletedAt)),
    db.select({ n: count() }).from(replies).where(isNull(replies.deletedAt)),
    db.select({ n: count() }).from(posts).where(gte(posts.createdAt, todayStart)),
  ]);
  return { members: m.n, posts: p.n, comments: c.n + r.n, todayPosts: t.n };
}

/** 최근 가입 20명. 로그인 방식은 지금 아이디(credential)뿐이다. */
export async function listRecentMembers() {
  return db
    .select({
      username: users.username,
      role: users.role,
      createdAt: users.createdAt,
      nickname: profiles.nickname,
      slug: blogs.slug,
      provider: sql<string | null>`(select min(${accounts.providerId}) from ${accounts} where ${accounts.userId} = ${users.id})`,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(blogs, eq(blogs.ownerId, users.id))
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(RECENT_MEMBERS);
}

/** 최근 30일 글, 최대 30개, 최신순 (공개·비공개 모두) */
export async function listRecentPosts() {
  return db
    .select({ id: posts.id, title: posts.title, isPublic: posts.isPublic, createdAt: posts.createdAt, slug: blogs.slug, nickname: profiles.nickname })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(and(gte(posts.createdAt, sql`now() - make_interval(days => ${RECENT_POST_DAYS})`)))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(RECENT_POSTS);
}
