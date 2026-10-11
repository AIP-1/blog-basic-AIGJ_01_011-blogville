import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { blogs, profiles, sessions } from "@/db/schema";
import { auth } from "@/lib/auth";

/** 유지 안 함 세션: 마지막 사용 2시간 뒤 무효 (AUTH-09) */
const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;
/** 마지막 사용 시각은 5분에 한 번만 기록한다 */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export type Member = { userId: string; username: string; role: string; sessionId: string };

/** 지금 요청의 로그인 회원. 없거나 만료면 null. 한 요청 안에서는 한 번만 묻는다. */
export const getSession = cache(async (): Promise<Member | null> => {
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;
  const { session, user } = result;
  const row = await db.query.sessions.findFirst({ where: eq(sessions.id, session.id) });
  if (!row) return null;

  if (!row.rememberMe) {
    const idle = Date.now() - row.updatedAt.getTime();
    if (idle > IDLE_LIMIT_MS) {
      await db.delete(sessions).where(eq(sessions.id, row.id));
      return null;
    }
    if (idle > TOUCH_EVERY_MS) {
      await db
        .update(sessions)
        .set({ updatedAt: new Date(), expiresAt: sql`now() + interval '2 hours'` })
        .where(and(eq(sessions.id, row.id), lt(sessions.updatedAt, new Date(Date.now() - TOUCH_EVERY_MS))));
    }
  }
  const u = user as typeof user & { username?: string; role?: string };
  return { userId: user.id, username: u.username ?? "", role: u.role ?? "user", sessionId: session.id };
});

/** 회원 전용 화면·Server Action의 첫 줄. 비로그인이면 첫 화면으로 보낸다 (NF-02). */
export async function requireMember(): Promise<Member> {
  const member = await getSession();
  if (!member) redirect("/");
  return member;
}

/** 회원의 블로그 (회원당 정확히 1개, BLOG-01) */
export async function getMyBlog(userId: string) {
  const blog = await db.query.blogs.findFirst({ where: eq(blogs.ownerId, userId) });
  if (!blog) throw new Error("블로그가 없는 회원");
  return blog;
}

export async function getNickname(userId: string): Promise<string> {
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  return profile?.nickname ?? "";
}
