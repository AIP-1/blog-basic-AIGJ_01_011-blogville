import "server-only";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { attendanceRewards, attendances, pointLedger, sessions, users } from "@/db/schema";
import { nextCycleDay } from "@/lib/game";
import { previousDay, todayKST } from "@/lib/kst";
import { lockUser } from "./points";

// 자동 출석 (GAME-04, specs/033-attendance)

export type TodayAttendance = { date: string; cycleDay: number; exp: number; coins: number };

/**
 * 오늘(한국 날짜) 출석. 없으면 기록하고 일차 보상을 원장에 넣는다. 이미 있으면 읽기만 한다.
 * 회원 행 → 회원 잠금 순서로 잡아(탈퇴와 같은 순서) 탭 여러 개가 동시에 열어도 한 번만 기록한다.
 * 회원이 그새 탈퇴했으면 null.
 */
export async function ensureTodayAttendance(userId: string, sessionId: string | null, now = new Date()): Promise<TodayAttendance | null> {
  const today = todayKST(now);
  // 이미 출석했으면 잠그지 않고 읽기만 한다 (화면마다 헤더가 부르므로)
  const hit = await readDay(db, userId, today);
  if (hit) return hit;
  return db.transaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (!member) return null;
    await lockUser(tx, userId);
    const found = await readDay(tx, userId, today);
    if (found) return found;
    const [last] = await tx
      .select({ date: attendances.date, cycleDay: attendances.cycleDay })
      .from(attendances)
      .where(and(eq(attendances.userId, userId), lt(attendances.date, today)))
      .orderBy(desc(attendances.date))
      .limit(1);
    const cycleDay = nextCycleDay(last ?? null, today, previousDay(today));
    // 세션 행이 아직 있을 때만 잇는다 (로그아웃·만료로 지워졌으면 비운다). 잠가 두어 그사이 지워져도 외래 키가 깨지지 않게 한다
    const [session] = sessionId ? await tx.select({ id: sessions.id }).from(sessions).where(eq(sessions.id, sessionId)).for("key share") : [];
    await tx.insert(attendances).values({ userId, date: today, cycleDay, sessionId: session?.id ?? null }).onConflictDoNothing();
    const [reward] = await tx.select().from(attendanceRewards).where(eq(attendanceRewards.day, cycleDay));
    await tx
      .insert(pointLedger)
      .values({ userId, reason: "attendance", expDelta: reward.exp, coinDelta: reward.coins, refId: today })
      .onConflictDoNothing();
    return { date: today, cycleDay, exp: reward.exp, coins: reward.coins };
  });
}

async function readDay(tx: Tx | typeof db, userId: string, day: string): Promise<TodayAttendance | null> {
  const [row] = await tx
    .select({ date: attendances.date, cycleDay: attendances.cycleDay, exp: pointLedger.expDelta, coins: pointLedger.coinDelta })
    .from(attendances)
    // 받은 보상은 원장에서 읽는다 (보상표가 나중에 바뀌어도 그날 받은 그대로)
    .innerJoin(pointLedger, and(eq(pointLedger.userId, attendances.userId), eq(pointLedger.reason, "attendance"), eq(pointLedger.refId, sql`${attendances.date}::text`)))
    .where(and(eq(attendances.userId, userId), eq(attendances.date, day)));
  return row ?? null;
}

/** 7일 보상표 */
export async function listAttendanceRewards() {
  return db.select().from(attendanceRewards).orderBy(asc(attendanceRewards.day));
}

/** 이번 달(한국 날짜) 출석한 날짜들 */
export async function listMonthAttendances(userId: string, monthStart: string, monthEnd: string): Promise<string[]> {
  const rows = await db
    .select({ date: attendances.date })
    .from(attendances)
    .where(and(eq(attendances.userId, userId), gte(attendances.date, monthStart), lte(attendances.date, monthEnd)))
    .orderBy(asc(attendances.date));
  return rows.map((r) => r.date);
}
