import "server-only";
import { and, count, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts, sessions } from "@/db/schema";

/**
 * 만료된 세션 (NF-26). 쓰는 세션은 만료 시각이 늘어나 있어 남는다.
 * 유지 안 함 세션은 마지막 사용 2시간 뒤 이미 무효라(`getSession`) 만료 시각이 남아 있어도 지운다.
 */
export async function cleanupSessions({ dryRun }: { dryRun: boolean }): Promise<number> {
  const expired = or(
    lt(sessions.expiresAt, sql`now()`),
    and(eq(sessions.rememberMe, false), lt(sessions.updatedAt, sql`now() - interval '2 hours'`)),
  );
  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(sessions).where(expired);
    return row.n;
  }
  return (await db.delete(sessions).where(expired).returning({ id: sessions.id })).length;
}

/** 잠겨 있지 않고 하루 넘게 실패가 없던 로그인 실패 기록 (NF-26, AUTH-09). 지우면 그 아이디의 실패 수가 0부터 다시 센다 */
export async function cleanupLoginAttempts({ dryRun }: { dryRun: boolean }): Promise<number> {
  const stale = and(
    or(isNull(loginAttempts.lockedUntil), lt(loginAttempts.lockedUntil, sql`now()`)),
    lt(loginAttempts.updatedAt, sql`now() - interval '1 day'`),
  );
  if (dryRun) {
    const [row] = await db.select({ n: count() }).from(loginAttempts).where(stale);
    return row.n;
  }
  return (await db.delete(loginAttempts).where(stale).returning({ username: loginAttempts.username })).length;
}
