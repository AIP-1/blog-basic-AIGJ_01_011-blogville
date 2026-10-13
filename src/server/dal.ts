import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { blogs, profiles, sessions } from "@/db/schema";
import { auth } from "@/lib/auth";

/** 유지 안 함 세션: 마지막 사용 2시간 뒤 무효 (AUTH-09) */
const IDLE_LIMIT_MS = 2 * 60 * 60 * 1000;
/** 마지막 사용 시각은 5분에 한 번만 기록한다 */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export type Member = {
  userId: string;
  username: string;
  role: string;
  sessionId: string;
  /** [로그인 상태 유지] 세션 (7일, SessionKeeper가 연장) */
  rememberMe: boolean;
};

/** 지금 요청의 로그인 회원. 없거나 만료면 null. 한 요청 안에서는 한 번만 묻는다. */
export const getSession = cache(async (): Promise<Member | null> => {
  // 서버 화면·액션에서는 늘리지 않는다: 화면을 그릴 때는 쿠키를 못 바꿔 DB만 늘고 쿠키는 그대로 남는다.
  // 유지 세션은 SessionKeeper의 세션 조회(라우트 핸들러)가 DB와 쿠키를 함께 늘린다 (AUTH-09)
  const result = await auth.api.getSession({ headers: await headers(), query: { disableRefresh: true } });
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
  return { userId: user.id, username: u.username ?? "", role: u.role ?? "user", sessionId: session.id, rememberMe: row.rememberMe };
});

/** 회원 전용 화면·Server Action의 첫 줄. 비로그인이면 첫 화면으로 보낸다 (NF-02). */
export async function requireMember(): Promise<Member> {
  const member = await getSession();
  if (!member) redirect("/");
  return member;
}

/** 관리자 화면·Action의 첫 줄. 로그인하지 않았거나 일반 회원이면 404 (관리자 화면이 있다는 것도 숨김, AUTH-08). */
export async function requireAdmin(): Promise<Member> {
  const member = await getSession();
  if (member?.role !== "admin") notFound();
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
