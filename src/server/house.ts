import "server-only";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { blogs, houseFurniture, items, userItems, users } from "@/db/schema";
import { HOUSE_ERRORS, houseInfo, slotOpenLevel } from "@/lib/house";
import { canChooseRoof, ROOF_ERRORS, type RoofCode } from "@/lib/roof";
import { getWallet, lockUser } from "./points";

// 우리 집 가구 (SHOP-05, specs/037-house)와 지붕 색 (TOWN-07, specs/041-roof-color)

export type PlacedFurniture = { slot: number; itemId: number; name: string; art: string };
export type OwnedFurniture = { id: number; name: string; art: string };

/** 칸에 놓인 가구 (누구나 본다) */
export async function getPlacedFurniture(userId: string): Promise<PlacedFurniture[]> {
  return db
    .select({ slot: houseFurniture.slot, itemId: items.id, name: items.name, art: items.art })
    .from(houseFurniture)
    .innerJoin(items, eq(items.id, houseFurniture.itemId))
    .where(eq(houseFurniture.userId, userId))
    .orderBy(asc(houseFurniture.slot));
}

/** 가진 가구 (주인의 고르기 목록) */
export async function getOwnedFurniture(userId: string): Promise<OwnedFurniture[]> {
  return db
    .select({ id: items.id, name: items.name, art: items.art })
    .from(userItems)
    .innerJoin(items, eq(items.id, userItems.itemId))
    .where(and(eq(userItems.userId, userId), eq(items.type, "furniture")))
    .orderBy(asc(items.id));
}

export type PlaceResult = { ok: true } | { ok: false; error: string };

/**
 * 가구 놓기 (SHOP-05): `itemId`가 null이면 그 칸을 비운다. 한 트랜잭션에서
 * [회원 행 KEY SHARE(탈퇴와 같은 순서) → 회원 잠금 → 레벨로 열린 칸 확인 → 가진 가구인지 → 다른 칸의 같은 가구를 지우고(옮기기) 그 칸에 저장].
 */
export async function placeFurniture(userId: string, slot: number, itemId: number | null): Promise<PlaceResult> {
  return db.transaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (!member) return { ok: false, error: HOUSE_ERRORS.slot };
    await lockUser(tx, userId);
    const info = houseInfo((await getWallet(userId, tx)).progress.level);
    if (slot >= info.slots) return { ok: false, error: info.nextLevel === null ? HOUSE_ERRORS.slot : HOUSE_ERRORS.locked(slotOpenLevel(slot)) };
    if (itemId === null) {
      await tx.delete(houseFurniture).where(and(eq(houseFurniture.userId, userId), eq(houseFurniture.slot, slot)));
      return { ok: true };
    }
    const [owned] = await tx
      .select({ id: items.id })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(and(eq(userItems.userId, userId), eq(userItems.itemId, itemId), eq(items.type, "furniture")));
    if (!owned) return { ok: false, error: HOUSE_ERRORS.notOwned };
    await tx.delete(houseFurniture).where(and(eq(houseFurniture.userId, userId), eq(houseFurniture.itemId, itemId), ne(houseFurniture.slot, slot)));
    await tx
      .insert(houseFurniture)
      .values({ userId, slot, itemId })
      .onConflictDoUpdate({ target: [houseFurniture.userId, houseFurniture.slot], set: { itemId } });
    return { ok: true };
  });
}

/**
 * 지붕 색 고르기 (TOWN-07): [회원 행 KEY SHARE → 회원 잠금 → 레벨로 집 단계를 다시 계산해 열린 색인지 확인 → 저장]. 무료.
 */
export async function chooseRoof(userId: string, code: RoofCode): Promise<PlaceResult> {
  return db.transaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (!member) return { ok: false, error: ROOF_ERRORS.unknown };
    await lockUser(tx, userId);
    const [blog] = await tx.select({ id: blogs.id }).from(blogs).where(eq(blogs.ownerId, userId));
    if (!blog) return { ok: false, error: ROOF_ERRORS.unknown };
    const { stage } = houseInfo((await getWallet(userId, tx)).progress.level);
    if (!canChooseRoof(blog.id, stage, code)) return { ok: false, error: ROOF_ERRORS.locked };
    await tx.update(blogs).set({ roofColor: code }).where(eq(blogs.id, blog.id));
    return { ok: true };
  });
}
