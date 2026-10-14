import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { foodSaved } from "@/db/schema";
import type { FoodPlace } from "@/lib/food";

// 🍽 ⭐ 가고 싶은 곳. 회원은 로그인 세션으로만 정한다 (Action이 넘긴 userId).

export const SAVED_PLACES_MAX = 200;

/** 저장·취소. 이미 저장했으면 지우고, 아니면 넣는다. 지금 저장했는지 (가득 차서 못 넣으면 null) */
export async function toggleSavedPlace(userId: string, place: FoodPlace): Promise<boolean | null> {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(foodSaved)
      .where(and(eq(foodSaved.userId, userId), eq(foodSaved.placeId, place.id)))
      .returning({ id: foodSaved.id });
    if (removed.length > 0) return false;
    const mine = await tx.select({ id: foodSaved.id }).from(foodSaved).where(eq(foodSaved.userId, userId)).limit(SAVED_PLACES_MAX);
    if (mine.length >= SAVED_PLACES_MAX) return null;
    await tx
      .insert(foodSaved)
      .values({
        userId,
        placeId: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        phone: place.phone,
        mapUrl: place.mapUrl,
        lat: place.lat,
        lng: place.lng,
      })
      .onConflictDoNothing();
    return true;
  });
}

/** 내 ⭐ 가고 싶은 곳, 최근 저장한 순 */
export async function listSavedPlaces(userId: string): Promise<FoodPlace[]> {
  const rows = await db
    .select()
    .from(foodSaved)
    .where(eq(foodSaved.userId, userId))
    .orderBy(desc(foodSaved.createdAt), desc(foodSaved.id))
    .limit(SAVED_PLACES_MAX);
  return rows.map((r) => ({
    id: r.placeId,
    name: r.name,
    category: r.category,
    address: r.address,
    phone: r.phone,
    mapUrl: r.mapUrl,
    lat: r.lat,
    lng: r.lng,
    distance: null,
  }));
}

/** 목록에 보이는 식당 중 내가 저장한 것의 id (☆/⭐ 표시용) */
export async function savedPlaceIds(userId: string | null, placeIds: string[]): Promise<Set<string>> {
  if (!userId || placeIds.length === 0) return new Set();
  const rows = await db
    .select({ placeId: foodSaved.placeId })
    .from(foodSaved)
    .where(and(eq(foodSaved.userId, userId), inArray(foodSaved.placeId, placeIds)));
  return new Set(rows.map((r) => r.placeId));
}
