import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { avatarEquips, items, profiles, userItems, users } from "@/db/schema";
import { EMPTY_STYLE, SALON_ERRORS, styleBill, type SalonItem, type Style } from "@/lib/salon";
import { STYLE_SLOTS, isAvatarSlot, type StyleSlot } from "@/lib/shop";
import { addLedgerEntry, getWallet, lockUser } from "./points";

// 미용실 (SHOP-07, specs/052-salon)

const isStyleSlot = (v: string): v is StyleSlot => (STYLE_SLOTS as readonly string[]).includes(v);

async function catalogOf(userId: string, tx: Pick<typeof db, "select"> = db): Promise<SalonItem[]> {
  const ownedIds = new Set((await tx.select({ itemId: userItems.itemId }).from(userItems).where(eq(userItems.userId, userId))).map((r) => r.itemId));
  const rows = await tx
    .select({ id: items.id, type: items.type, name: items.name, art: items.art, price: items.price, requiredLevel: items.requiredLevel })
    .from(items)
    .where(inArray(items.type, [...STYLE_SLOTS]))
    .orderBy(asc(items.price), asc(items.id));
  return rows.flatMap((r) => (isStyleSlot(r.type) ? [{ id: r.id, slot: r.type, name: r.name, art: r.art, price: r.price, requiredLevel: r.requiredLevel, owned: ownedIds.has(r.id) }] : []));
}

async function currentStyle(userId: string, tx: Pick<typeof db, "select"> = db): Promise<Style> {
  const rows = await tx.select({ slot: avatarEquips.slot, itemId: avatarEquips.itemId }).from(avatarEquips).where(eq(avatarEquips.userId, userId));
  const style: Style = { ...EMPTY_STYLE };
  for (const r of rows) if (isStyleSlot(r.slot)) style[r.slot] = r.itemId;
  return style;
}

/** 미용실 화면: 내 캐릭터, 입은 옷(거울에 같이), 고를 수 있는 것, 지금 머리, 레벨·코인 */
export async function getSalon(userId: string) {
  const [[character], catalog, current, wallet, worn] = await Promise.all([
    db.select({ art: items.art }).from(profiles).leftJoin(items, eq(items.id, profiles.characterItemId)).where(eq(profiles.userId, userId)),
    catalogOf(userId),
    currentStyle(userId),
    getWallet(userId),
    db.select({ slot: avatarEquips.slot, art: items.art }).from(avatarEquips).innerJoin(items, eq(items.id, avatarEquips.itemId)).where(eq(avatarEquips.userId, userId)),
  ]);
  const outfit: Record<string, string> = {};
  for (const w of worn) if (isAvatarSlot(w.slot)) outfit[w.slot] = w.art;
  return { character: character?.art ?? null, outfit, catalog, current, level: wallet.progress.level, coins: wallet.coin };
}

export type StyleResult = { ok: true; paid: string[]; total: number } | { ok: false; error: string };

/** 한 번에 받고 바꾸기 (옷가게 applyOutfit과 같은 순서). 무료는 원장 없이 인벤토리에만 */
export async function applyStyle(userId: string, style: Style, pay: number): Promise<StyleResult> {
  return db.transaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (!member) return { ok: false, error: SALON_ERRORS.invalid };
    await lockUser(tx, userId);
    const catalog = await catalogOf(userId, tx);
    for (const slot of STYLE_SLOTS) {
      const id = style[slot];
      if (id !== null && !catalog.some((i) => i.id === id && i.slot === slot)) return { ok: false, error: SALON_ERRORS.invalid };
    }
    const [current, wallet] = await Promise.all([currentStyle(userId, tx), getWallet(userId, tx)]);
    const bill = styleBill(style, current, catalog, wallet.progress.level, wallet.coin);
    if (bill.kind === "same") return { ok: false, error: SALON_ERRORS.same };
    if (bill.kind === "level") return { ok: false, error: SALON_ERRORS.level(bill.level) };
    if (bill.total !== pay) return { ok: false, error: SALON_ERRORS.price };
    if (bill.kind === "coins") return { ok: false, error: SALON_ERRORS.coins(bill.short) };
    for (const item of bill.buy) {
      await tx.insert(userItems).values({ userId, itemId: item.id });
      if (item.price > 0) await addLedgerEntry(tx, { userId, reason: "purchase", expDelta: 0, coinDelta: -item.price, refId: String(item.id) });
    }
    for (const slot of STYLE_SLOTS) {
      const itemId = style[slot];
      if (itemId === current[slot]) continue;
      if (itemId === null) await tx.delete(avatarEquips).where(and(eq(avatarEquips.userId, userId), eq(avatarEquips.slot, slot)));
      else await tx.insert(avatarEquips).values({ userId, slot, itemId }).onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId } });
    }
    return { ok: true, paid: bill.buy.filter((i) => i.price > 0).map((i) => i.name), total: bill.total };
  });
}
