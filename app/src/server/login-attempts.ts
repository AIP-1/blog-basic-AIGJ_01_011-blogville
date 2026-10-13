import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

export const MAX_FAILURES = 5;

/**
 * 로그인 전에 실패 하나를 미리 센다 (NF-10). 잠금 중이면 false.
 * 5번째 실패가 세어지면 그 뒤 5분 동안 잠근다. 시각은 DB 기준.
 */
export async function reserveLoginAttempt(username: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    await tx
      .insert(loginAttempts)
      .values({ username, failures: 0 })
      // 있던 행도 이 트랜잭션이 끝날 때까지 잠근다 (정리 작업이 그 사이에 지우지 못하게)
      .onConflictDoUpdate({ target: loginAttempts.username, set: { username: sql`excluded.username` } });
    const [row] = await tx
      .select({
        failures: loginAttempts.failures,
        locked: sql<boolean>`coalesce(${loginAttempts.lockedUntil} > now(), false)`,
      })
      .from(loginAttempts)
      .where(eq(loginAttempts.username, username))
      .for("update");
    if (row.locked) return false;

    const failures = row.failures + 1;
    await tx
      .update(loginAttempts)
      .set(
        failures >= MAX_FAILURES
          ? { failures: 0, lockedUntil: sql`now() + interval '5 minutes'`, updatedAt: sql`now()` }
          : { failures, lockedUntil: null, updatedAt: sql`now()` },
      )
      .where(eq(loginAttempts.username, username));
    return true;
  });
}

export async function clearLoginAttempts(username: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.username, username));
}
