"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/lib/ids";
import { CLOSET_ERRORS, equipMessage } from "@/lib/shop";
import { requireMember } from "@/server/dal";
import { equipItem as equip } from "@/server/items";

// 꾸미기 (SHOP-04·06). 가진 아이템만 장착한다. 화면은 먼저 바꾸고(낙관적) 이 결과로 확인·되돌린다.

export type EquipState = { ok: boolean; message: string };

/** `wear`: 입기(걸기)면 true, 벗기면 false */
export async function equipItem(rawId: unknown, wear: unknown = true): Promise<EquipState> {
  const member = await requireMember();
  const itemId = parseId(rawId);
  if (itemId === null) return { ok: false, message: CLOSET_ERRORS.notOwned };
  if (typeof wear !== "boolean") return { ok: false, message: CLOSET_ERRORS.failed };
  const result = await equip(member.userId, itemId, wear);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/", "layout");
  return { ok: true, message: equipMessage(result.name, result.removed) };
}
