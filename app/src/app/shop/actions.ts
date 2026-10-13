"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/lib/ids";
import { purchaseMessage, SHOP_ERRORS } from "@/lib/shop";
import { requireMember } from "@/server/dal";
import { buyItem as buy } from "@/server/shop";

// 마을 상점 (SHOP-01). 화면 버튼을 우회해도 서버가 다시 확인한다.

export type BuyState = { ok: boolean; message: string; type?: string } | null;

export async function buyItem(_prev: BuyState, formData: FormData): Promise<BuyState> {
  const member = await requireMember();
  const itemId = parseId(formData.get("itemId"));
  if (itemId === null) return { ok: false, message: SHOP_ERRORS.invalid };
  const result = await buy(member.userId, itemId);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/", "layout");
  return { ok: true, message: purchaseMessage(result.name, result.type), type: result.type };
}
