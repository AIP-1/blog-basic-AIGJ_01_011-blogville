import "server-only";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { items, userItems, users } from "@/db/schema";
import { buttonState, isStackable, SHOP_ERRORS, type ItemType, type ShopItem } from "@/lib/shop";
import { addLedgerEntry, getWallet, lockUser } from "./points";

// 마을 상점 (SHOP-01·02·03, specs/035-shop)

/** 파는 아이템 (기본 아이템·캐릭터는 `is_on_sale`이 거짓이라 빠진다) + 내가 가졌는지 + 가진 회원 수 */
export async function listShopItems(userId: string): Promise<ShopItem[]> {
  const owners = db
    .select({ itemId: userItems.itemId, n: count().as("owners") })
    .from(userItems)
    .groupBy(userItems.itemId)
    .as("owners");
  const rows = await db
    .select({
      id: items.id,
      type: items.type,
      name: items.name,
      description: items.description,
      art: items.art,
      price: items.price,
      requiredLevel: items.requiredLevel,
      quantity: sql<number>`coalesce((select ${userItems.quantity} from ${userItems} where ${userItems.userId} = ${userId} and ${userItems.itemId} = ${items.id}), 0)::int`,
      owners: sql<number>`coalesce(${owners.n}, 0)::int`,
    })
    .from(items)
    .leftJoin(owners, eq(owners.itemId, items.id))
    .where(eq(items.isOnSale, true))
    .orderBy(asc(items.id));
  return rows.map((r) => ({ ...r, type: r.type as ItemType, owned: r.quantity > 0 }));
}

export type BuyResult = { ok: true; name: string; type: string } | { ok: false; error: string };

/**
 * 사기 (SHOP-01·02·03): 한 트랜잭션에서 [회원 행 KEY SHARE(탈퇴와 같은 순서) → 회원 잠금 → 아이템 확인 → 보유 확인(성장 아이템은 개수 +1) →
 * 그 순간의 레벨·코인 확인 → 인벤토리에 넣기 → 원장 `purchase`(−가격, ref = 아이템 ID)].
 * 같은 회원의 구매·보상은 잠금으로 한 줄로 서므로 코인이 0 아래로 내려가지 않는다.
 */
export async function buyItem(userId: string, itemId: number): Promise<BuyResult> {
  return db.transaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (!member) return { ok: false, error: SHOP_ERRORS.invalid };
    await lockUser(tx, userId);
    const [item] = await tx
      .select({ id: items.id, type: items.type, name: items.name, price: items.price, requiredLevel: items.requiredLevel })
      .from(items)
      .where(and(eq(items.id, itemId), eq(items.isOnSale, true)));
    if (!item) return { ok: false, error: SHOP_ERRORS.invalid };
    const [owned] = await tx
      .select({ one: sql`1` })
      .from(userItems)
      .where(and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)));
    const wallet = await getWallet(userId, tx);
    const state = buttonState({ type: item.type as ItemType, owned: owned !== undefined, requiredLevel: item.requiredLevel, price: item.price }, wallet.progress.level, wallet.coin);
    if (state.kind === "owned") return { ok: false, error: SHOP_ERRORS.owned };
    if (state.kind === "level") return { ok: false, error: SHOP_ERRORS.level(state.level) };
    if (state.kind === "coins") return { ok: false, error: SHOP_ERRORS.coins(item.price - wallet.coin) };
    // 성장 아이템은 개수만 늘린다 (TOWN-09)
    if (owned) await tx.update(userItems).set({ quantity: sql`${userItems.quantity} + 1` }).where(and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)));
    else await tx.insert(userItems).values({ userId, itemId });
    // 아이템마다 한 번 사는 `purchase`는 (회원, 아이템) 고유라, 여러 번 사는 성장 아이템은 사유를 따로 둔다
    await addLedgerEntry(tx, { userId, reason: isStackable(item.type) ? "growth_purchase" : "purchase", expDelta: 0, coinDelta: -item.price, refId: String(itemId) });
    return { ok: true, name: item.name, type: item.type };
  });
}
