import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { avatarEquips, items, profiles, userItems, users } from "@/db/schema";
import { CLOTHES_ERRORS, EMPTY_OUTFIT, outfitBill, type ClothesItem, type Outfit } from "@/lib/clothes";
import { AVATAR_SLOTS, isAvatarSlot } from "@/lib/shop";
import { addLedgerEntry, getWallet, lockUser } from "./points";

// 옷가게 (SHOP-08, specs/051-clothes-shop)

/** 옷가게에 거는 것: 파는 아바타 아이템 + 내가 가진 아바타 아이템(안 파는 기본 것 포함) */
async function catalogOf(userId: string, tx: Pick<typeof db, "select"> = db): Promise<ClothesItem[]> {
  const owned = tx.select({ itemId: userItems.itemId }).from(userItems).where(eq(userItems.userId, userId));
  const ownedIds = new Set((await owned).map((r) => r.itemId));
  const rows = await tx
    .select({ id: items.id, type: items.type, name: items.name, art: items.art, price: items.price, requiredLevel: items.requiredLevel, isOnSale: items.isOnSale })
    .from(items)
    .where(inArray(items.type, [...AVATAR_SLOTS]))
    .orderBy(asc(items.price), asc(items.id));
  return rows.flatMap((r) =>
    isAvatarSlot(r.type) && (r.isOnSale || ownedIds.has(r.id))
      ? [{ id: r.id, slot: r.type, name: r.name, art: r.art, price: r.price, requiredLevel: r.requiredLevel, owned: ownedIds.has(r.id) }]
      : [],
  );
}

async function currentOutfit(userId: string, tx: Pick<typeof db, "select"> = db): Promise<Outfit> {
  const rows = await tx.select({ slot: avatarEquips.slot, itemId: avatarEquips.itemId }).from(avatarEquips).where(eq(avatarEquips.userId, userId));
  const outfit: Outfit = { ...EMPTY_OUTFIT };
  for (const r of rows) if (isAvatarSlot(r.slot)) outfit[r.slot] = r.itemId;
  return outfit;
}

/** 옷가게 화면: 내 캐릭터, 고를 수 있는 것, 지금 입은 것, 레벨·코인 */
export async function getClothesShop(userId: string) {
  const [[character], catalog, current, wallet] = await Promise.all([
    db.select({ art: items.art }).from(profiles).leftJoin(items, eq(items.id, profiles.characterItemId)).where(eq(profiles.userId, userId)),
    catalogOf(userId),
    currentOutfit(userId),
    getWallet(userId),
  ]);
  return { character: character?.art ?? null, catalog, current, level: wallet.progress.level, coins: wallet.coin };
}

export type OutfitResult = { ok: true; bought: string[]; total: number } | { ok: false; error: string };

/**
 * 한 번에 사서 입기: 한 트랜잭션에서 [회원 행 KEY SHARE(탈퇴와 같은 순서) → 회원 잠금 → 고른 것 확인 →
 * 화면 합계(`pay`)와 서버 합계 비교 → 레벨·코인 확인 → 안 가진 것을 인벤토리에 넣고 원장 `purchase`(아이템마다) → 부위별 입기·벗기].
 */
export async function applyOutfit(userId: string, outfit: Outfit, pay: number): Promise<OutfitResult> {
  return db.transaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (!member) return { ok: false, error: CLOTHES_ERRORS.invalid };
    await lockUser(tx, userId);
    const catalog = await catalogOf(userId, tx);
    for (const slot of AVATAR_SLOTS) {
      const id = outfit[slot];
      if (id !== null && !catalog.some((i) => i.id === id && i.slot === slot)) return { ok: false, error: CLOTHES_ERRORS.invalid };
    }
    const [current, wallet] = await Promise.all([currentOutfit(userId, tx), getWallet(userId, tx)]);
    const bill = outfitBill(outfit, current, catalog, wallet.progress.level, wallet.coin);
    if (bill.kind === "same") return { ok: false, error: CLOTHES_ERRORS.same };
    if (bill.kind === "level") return { ok: false, error: CLOTHES_ERRORS.level(bill.level) };
    if (bill.total !== pay) return { ok: false, error: CLOTHES_ERRORS.price };
    if (bill.kind === "coins") return { ok: false, error: CLOTHES_ERRORS.coins(bill.short) };
    for (const item of bill.buy) {
      await tx.insert(userItems).values({ userId, itemId: item.id });
      await addLedgerEntry(tx, { userId, reason: "purchase", expDelta: 0, coinDelta: -item.price, refId: String(item.id) });
    }
    for (const slot of AVATAR_SLOTS) {
      const itemId = outfit[slot];
      if (itemId === current[slot]) continue;
      if (itemId === null) await tx.delete(avatarEquips).where(and(eq(avatarEquips.userId, userId), eq(avatarEquips.slot, slot)));
      else
        await tx
          .insert(avatarEquips)
          .values({ userId, slot, itemId })
          .onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId } });
    }
    return { ok: true, bought: bill.buy.map((i) => i.name), total: bill.total };
  });
}
