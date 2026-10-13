import "server-only";
import { and, count, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { errorLogs } from "@/db/schema";
import { snippet } from "@/lib/admin-rules";
import { GROUP_WINDOW_MS, PRUNE_CHANCE, RETENTION_DAYS, rangeSince, type ErrorEntry, type ErrorRange } from "@/lib/error-log-rules";
import { writeAudit } from "./admin-tools";

// 서버 오류 기록 (instrumentation.ts의 onRequestError가 부른다). 부르는 쪽이 try/catch·시간 제한을 건다.

/** 한 건 기록: 1시간 안의 같은 오류(같은 경로 + 같은 digest, 없으면 같은 메시지)면 count만 올린다 */
export async function recordError(entry: ErrorEntry) {
  const since = new Date(Date.now() - GROUP_WINDOW_MS);
  const sameRoute = entry.routePath === null ? isNull(errorLogs.routePath) : eq(errorLogs.routePath, entry.routePath);
  const sameError = entry.digest ? eq(errorLogs.digest, entry.digest) : and(isNull(errorLogs.digest), eq(errorLogs.message, entry.message));
  const [hit] = await db
    .select({ id: errorLogs.id })
    .from(errorLogs)
    .where(and(sameRoute, sameError, gt(errorLogs.lastSeenAt, since)))
    .orderBy(desc(errorLogs.lastSeenAt))
    .limit(1);
  if (hit) {
    await db
      .update(errorLogs)
      .set({ count: sql`${errorLogs.count} + 1`, lastSeenAt: sql`now()` })
      .where(eq(errorLogs.id, hit.id));
  } else {
    await db.insert(errorLogs).values(entry);
    // 표를 작게: 새 줄을 넣을 때 가끔 30일 지난 줄을 지운다
    if (Math.random() < PRUNE_CHANCE) await pruneErrors();
  }
}

export async function pruneErrors() {
  await db.delete(errorLogs).where(lt(errorLogs.lastSeenAt, sql`now() - make_interval(days => ${RETENTION_DAYS})`));
}

const sinceWhere = (range: ErrorRange) => {
  const since = rangeSince(range);
  return since ? gt(errorLogs.lastSeenAt, since) : undefined;
};

/** 관리자 오류 화면: 마지막으로 난 순서 (최대 200줄) */
export async function listErrors(range: ErrorRange) {
  return db.select().from(errorLogs).where(sinceWhere(range)).orderBy(desc(errorLogs.lastSeenAt), desc(errorLogs.id)).limit(200);
}

/** 대시보드: 최근 24시간에 난 오류 횟수 (묶인 횟수까지 더한다) */
export async function countRecentErrors() {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${errorLogs.count}), 0)::int`, groups: count() })
    .from(errorLogs)
    .where(sinceWhere("24h"));
  return { total: row?.total ?? 0, groups: row?.groups ?? 0 };
}

/** 해결함: 그 묶음을 지우고 관리 기록에 남긴다. 이미 없으면 false */
export async function resolveError(adminId: string, id: number) {
  return db.transaction(async (tx) => {
    const [row] = await tx.delete(errorLogs).where(eq(errorLogs.id, id)).returning();
    if (!row) return false;
    await writeAudit(tx, adminId, "resolve_error", { type: "site", id, label: snippet(row.message) }, `${row.routePath ?? "-"} · ${row.count}회`);
    return true;
  });
}
