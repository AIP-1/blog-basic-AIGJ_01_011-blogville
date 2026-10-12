import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { pointLedger } from "@/db/schema";
import { LEDGER_PAGE_SIZE, levelProgress, REWARD_RULES, type RewardReason } from "@/lib/game";
import { notifyLevelUps } from "./notifications";

// 경험치·코인 원장 (GAME-02·03·05·07, specs/031-points-levels)

/** 한국 시간 오늘 0시 (하루 상한 기준) */
const startOfTodayKST = sql`(date_trunc('day', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')`;

/** 회원 단위 잠금. 트랜잭션이 끝나면 풀린다 (같은 회원의 보상이 동시에 상한을 넘지 않게) */
export async function lockUser(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${"points:" + userId}))`);
}

/**
 * 원장에 한 줄 넣는다. 같은 기록이 이미 있으면(고유 인덱스) 넣지 않고 false.
 * 경험치가 있으면 넣기 전후 누적 경험치로 오른 레벨을 구해 레벨업 알림을 같이 넣는다 (GAME-06).
 * `lockUser`를 잡은 트랜잭션 안에서 불러야 누적 경험치가 어긋나지 않는다.
 */
export async function addLedgerEntry(
  tx: Tx,
  entry: { userId: string; reason: RewardReason; expDelta: number; coinDelta: number; refId: string | null },
): Promise<boolean> {
  const before = entry.expDelta > 0 ? await sumExp(tx, entry.userId) : 0;
  const added = await tx.insert(pointLedger).values(entry).onConflictDoNothing().returning({ id: pointLedger.id });
  if (added.length === 0) return false;
  if (entry.expDelta > 0) await notifyLevelUps(tx, entry.userId, before, before + entry.expDelta);
  return true;
}

async function sumExp(tx: Tx, userId: string): Promise<number> {
  const [row] = await tx
    .select({ exp: sql<number>`coalesce(sum(${pointLedger.expDelta}), 0)::int` })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  return row.exp;
}

/**
 * 보상 지급 (GAME-05): 회원을 잠그고 오늘 같은 사유로 받은 횟수가 하루 상한보다 적을 때만 원장에 한 줄 넣는다.
 * 넣었으면 true. 활동 자체는 이 결과와 관계없이 성공한다. 같은 트랜잭션 안에서 부른다.
 */
export async function grantReward(tx: Tx, userId: string, reason: Exclude<RewardReason, "attendance">, refId: string | null = null): Promise<boolean> {
  const rule = REWARD_RULES[reason];
  await lockUser(tx, userId);
  const [{ n }] = await tx
    .select({ n: count() })
    .from(pointLedger)
    .where(and(eq(pointLedger.userId, userId), eq(pointLedger.reason, reason), gte(pointLedger.createdAt, startOfTodayKST)));
  if (n >= rule.dailyLimit) return false;
  return addLedgerEntry(tx, { userId, reason, expDelta: rule.exp, coinDelta: rule.coin, refId });
}

/** 이 사유·ref 기록이 이미 있는지 (공감 보상은 같은 사람·같은 글에 한 번만) */
export async function hasLedgerEntry(tx: Tx | typeof db, userId: string, reason: RewardReason, refId: string): Promise<boolean> {
  const rows = await tx
    .select({ id: pointLedger.id })
    .from(pointLedger)
    .where(and(eq(pointLedger.userId, userId), eq(pointLedger.reason, reason), eq(pointLedger.refId, refId)))
    .limit(1);
  return rows.length > 0;
}

export type Wallet = { exp: number; coin: number; progress: ReturnType<typeof levelProgress> };

/** 누적 경험치·코인과 레벨 진행 (헤더·내역 화면) */
export async function getWallet(userId: string): Promise<Wallet> {
  const [row] = await db
    .select({
      exp: sql<number>`coalesce(sum(${pointLedger.expDelta}), 0)::int`,
      coin: sql<number>`coalesce(sum(${pointLedger.coinDelta}), 0)::int`,
    })
    .from(pointLedger)
    .where(eq(pointLedger.userId, userId));
  return { exp: row.exp, coin: row.coin, progress: levelProgress(row.exp) };
}

/** 내역 화면 (GAME-07): 내 기록 최신순 20개씩 */
export async function listLedger(userId: string, page: number) {
  const [items, [{ total }]] = await Promise.all([
    db
      .select({ id: pointLedger.id, reason: pointLedger.reason, expDelta: pointLedger.expDelta, coinDelta: pointLedger.coinDelta, createdAt: pointLedger.createdAt })
      .from(pointLedger)
      .where(eq(pointLedger.userId, userId))
      .orderBy(desc(pointLedger.createdAt), desc(pointLedger.id))
      .limit(LEDGER_PAGE_SIZE)
      .offset((page - 1) * LEDGER_PAGE_SIZE),
    db.select({ total: count() }).from(pointLedger).where(eq(pointLedger.userId, userId)),
  ]);
  return { items: items as (typeof items[number] & { reason: RewardReason })[], total };
}

/** 이 글로 글쓰기 보상을 받았는지 (발행 안내, POST-01) */
export async function hasPostReward(userId: string, postId: number): Promise<boolean> {
  return hasLedgerEntry(db, userId, "post", String(postId));
}
