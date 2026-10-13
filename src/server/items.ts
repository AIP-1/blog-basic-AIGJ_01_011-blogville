import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { avatarEquips, blogs, items, profiles, userItems, users } from "@/db/schema";
import { avatarLayers, CLOSET_ERRORS, isAvatarSlot, type AvatarSlot } from "@/lib/shop";

// 아이템·캐릭터 (GAME-01, specs/032-pixel-characters) · 꾸미기 (SHOP-04·06, specs/036-closet)

export type StarterCharacter = { id: number; name: string; art: string };

/** 가입 화면의 `캐릭터 고르기`: 기본 캐릭터, items.id 순서 */
export async function listStarterCharacters(): Promise<StarterCharacter[]> {
  return db
    .select({ id: items.id, name: items.name, art: items.art })
    .from(items)
    .where(and(eq(items.type, "character"), eq(items.isStarter, true)))
    .orderBy(asc(items.id));
}

/** 가입 트랜잭션에서 고른 ID를 다시 확인한다: 기본 캐릭터면 그 ID, 아니면 null */
export async function findStarterCharacter(tx: Tx, id: number): Promise<number | null> {
  const [row] = await tx
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.id, id), eq(items.type, "character"), eq(items.isStarter, true)));
  return row?.id ?? null;
}

/** 입은 아바타 아이템의 그림 (부위 → 그림 키) */
async function equippedArts(userIds: string[]): Promise<Map<string, Partial<Record<AvatarSlot, string>>>> {
  const map = new Map<string, Partial<Record<AvatarSlot, string>>>();
  if (userIds.length === 0) return map;
  const rows = await db
    .select({ userId: avatarEquips.userId, slot: avatarEquips.slot, art: items.art })
    .from(avatarEquips)
    .innerJoin(items, eq(items.id, avatarEquips.itemId))
    .where(inArray(avatarEquips.userId, userIds));
  for (const r of rows) if (isAvatarSlot(r.slot)) map.set(r.userId, { ...map.get(r.userId), [r.slot]: r.art });
  return map;
}

/** 내 캐릭터를 그릴 그림들 (캐릭터 → 옷 → 소품 → 모자). 캐릭터가 없으면 빈 배열 */
export async function getAvatar(userId: string): Promise<{ layers: string[]; name: string | null }> {
  const [[row], equips] = await Promise.all([
    db.select({ art: items.art, name: items.name }).from(profiles).innerJoin(items, eq(items.id, profiles.characterItemId)).where(eq(profiles.userId, userId)),
    equippedArts([userId]),
  ]);
  return { layers: avatarLayers(row?.art, equips.get(userId) ?? {}), name: row?.name ?? null };
}

/** 여러 회원의 입은 모습 (걸어 다니는 이웃, TOWN-19). 캐릭터가 없으면 빈 배열 */
export async function avatarLayersOf(userIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (userIds.length === 0) return map;
  const [rows, equips] = await Promise.all([
    db.select({ userId: profiles.userId, art: items.art }).from(profiles).innerJoin(items, eq(items.id, profiles.characterItemId)).where(inArray(profiles.userId, userIds)),
    equippedArts(userIds),
  ]);
  for (const id of userIds) map.set(id, avatarLayers(rows.find((r) => r.userId === id)?.art, equips.get(id) ?? {}));
  return map;
}

export type ClosetItem = { id: number; type: string; name: string; art: string; equipped: boolean };

/** 꾸미기 화면: 가진 아바타·배경·가구와 지금 입은·건 것 */
export async function getCloset(userId: string) {
  const [owned, [blog], [character], equips] = await Promise.all([
    db
      .select({ id: items.id, type: items.type, name: items.name, art: items.art })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(eq(userItems.userId, userId))
      .orderBy(asc(items.id)),
    db.select({ backgroundItemId: blogs.backgroundItemId }).from(blogs).where(eq(blogs.ownerId, userId)),
    db.select({ art: items.art, nickname: profiles.nickname }).from(profiles).leftJoin(items, eq(items.id, profiles.characterItemId)).where(eq(profiles.userId, userId)),
    db.select({ slot: avatarEquips.slot, itemId: avatarEquips.itemId }).from(avatarEquips).where(eq(avatarEquips.userId, userId)),
  ]);
  const worn = new Set(equips.map((e) => e.itemId));
  const mark = (i: (typeof owned)[number]): ClosetItem => ({ ...i, equipped: worn.has(i.id) || i.id === blog?.backgroundItemId });
  return {
    character: character?.art ?? null,
    nickname: character?.nickname ?? "",
    avatar: owned.filter((i) => isAvatarSlot(i.type)).map(mark),
    backgrounds: owned.filter((i) => i.type === "background").map(mark),
    furniture: owned.filter((i) => i.type === "furniture").map(mark),
  };
}

export type EquipResult = { ok: true; name: string; removed: boolean } | { ok: false; error: string };

/**
 * 장착 (SHOP-04·06): 가진 아이템만. 배경은 블로그 미니룸에 걸고, 모자·옷·소품은 부위마다 하나.
 * `wear = false`면 그 아이템을 벗는다(입고 있을 때만). 화면이 고른 대로 하므로 탭 두 개에서 눌러도 엇갈리지 않는다.
 * 가진 것만 걸리는 건 복합 외래 키가 한 번 더 막는다.
 */
export async function equipItem(userId: string, itemId: number, wear: boolean): Promise<EquipResult> {
  return db.transaction(async (tx) => {
    // 탈퇴(deleteMember)와 같은 순서로 회원 행을 먼저 잡는다
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("key share");
    if (!member) return { ok: false, error: CLOSET_ERRORS.notOwned };
    const [item] = await tx
      .select({ id: items.id, type: items.type, name: items.name })
      .from(userItems)
      .innerJoin(items, eq(items.id, userItems.itemId))
      .where(and(eq(userItems.userId, userId), eq(userItems.itemId, itemId)));
    if (!item) return { ok: false, error: CLOSET_ERRORS.notOwned };
    if (item.type === "background") {
      // 배경은 늘 하나가 걸려 있어 벗을 수 없다
      if (!wear) return { ok: false, error: CLOSET_ERRORS.wrongType };
      await tx.update(blogs).set({ backgroundItemId: item.id }).where(eq(blogs.ownerId, userId));
      return { ok: true, name: item.name, removed: false };
    }
    if (!isAvatarSlot(item.type)) return { ok: false, error: CLOSET_ERRORS.wrongType };
    const slot = item.type;
    if (!wear) {
      await tx.delete(avatarEquips).where(and(eq(avatarEquips.userId, userId), eq(avatarEquips.slot, slot), eq(avatarEquips.itemId, item.id)));
      return { ok: true, name: item.name, removed: true };
    }
    await tx
      .insert(avatarEquips)
      .values({ userId, slot, itemId: item.id })
      .onConflictDoUpdate({ target: [avatarEquips.userId, avatarEquips.slot], set: { itemId: item.id } });
    return { ok: true, name: item.name, removed: false };
  });
}
