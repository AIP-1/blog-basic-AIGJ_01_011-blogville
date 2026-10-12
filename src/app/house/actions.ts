"use server";

import { revalidatePath } from "next/cache";
import { HOUSE_ERRORS, parseSlot } from "@/lib/house";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { placeFurniture as place } from "@/server/house";

// 우리 집 가구 놓기 (SHOP-05). 내 집에만 놓는다.

export type PlaceState = { ok: boolean; error?: string };

/** `itemId`가 null이면 그 칸을 비운다 */
export async function placeFurniture(rawSlot: unknown, rawItemId: unknown): Promise<PlaceState> {
  const member = await requireMember();
  const slot = parseSlot(rawSlot);
  if (slot === null) return { ok: false, error: HOUSE_ERRORS.slot };
  const itemId = rawItemId === null ? null : parseId(rawItemId);
  if (rawItemId !== null && itemId === null) return { ok: false, error: HOUSE_ERRORS.notOwned };
  const result = await place(member.userId, slot, itemId);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/", "layout");
  return { ok: true };
}
