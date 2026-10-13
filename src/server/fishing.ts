import "server-only";
import { randomInt } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { fishingCatches, items, userItems, users } from "@/db/schema";
import { FEED_ITEM_CODE, findCatch, FISHING_DONE, pickCatch, type CatchCode } from "@/lib/fishing";
import { todayKST } from "@/lib/kst";
import { addLedgerEntry, lockUser } from "./points";

// 연못 낚시터 (TOWN-14, specs/046-fishing)

export type FishingLog = { date: string; catch: CatchCode };

/** 오늘 낚은 것(없으면 null)과 최근 7번 (날짜 최신순) */
export async function getFishing(userId: string): Promise<{ today: CatchCode | null; recent: FishingLog[] }> {
  const recent = await db
    .select({ date: fishingCatches.date, catch: fishingCatches.catch })
    .from(fishingCatches)
    .where(eq(fishingCatches.userId, userId))
    .orderBy(desc(fishingCatches.date))
    .limit(7);
  const today = todayKST();
  const logs = recent.map((r) => ({ date: r.date, catch: r.catch as CatchCode }));
  return { today: logs.find((r) => r.date === today)?.catch ?? null, recent: logs };
}

export type CastResult = { ok: true; catch: CatchCode } | { ok: false; error: string };

/**
 * 낚싯대 던지기: 무엇을 낚을지 서버가 정하고, 한 트랜잭션에서 [회원 행 KEY SHARE → 회원 잠금 → 오늘 기록 넣기(기본 키가 하루 한 번을 지킨다)
 * → 코인이면 원장 `fishing`(ref = 날짜), 먹이 꾸러미면 동물 먹이 +1].
 */
export async function castLine(userId: string): Promise<CastResult> {
  const code = pickCatch(randomInt(100));
  const prize = findCatch(code)!;
  const date = todayKST();
  return db.transaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (!member) return { ok: false, error: FISHING_DONE };
    await lockUser(tx, userId);
    const added = await tx.insert(fishingCatches).values({ userId, date, catch: code }).onConflictDoNothing().returning({ date: fishingCatches.date });
    if (added.length === 0) return { ok: false, error: FISHING_DONE };
    if (prize.coin !== null) {
      await addLedgerEntry(tx, { userId, reason: "fishing", expDelta: 0, coinDelta: prize.coin, refId: date });
    } else {
      const [feed] = await tx.select({ id: items.id }).from(items).where(and(eq(items.code, FEED_ITEM_CODE), eq(items.type, "growth")));
      if (!feed) throw new Error("동물 먹이 아이템이 없음");
      await tx
        .insert(userItems)
        .values({ userId, itemId: feed.id })
        .onConflictDoUpdate({ target: [userItems.userId, userItems.itemId], set: { quantity: sql`${userItems.quantity} + 1` } });
    }
    return { ok: true, catch: code };
  });
}
