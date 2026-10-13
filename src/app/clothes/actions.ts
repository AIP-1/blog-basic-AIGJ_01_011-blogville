"use server";

import { revalidatePath } from "next/cache";
import { CLOTHES_ERRORS, outfitMessage, parseOutfit, parsePay } from "@/lib/clothes";
import { requireMember } from "@/server/dal";
import { applyOutfit } from "@/server/clothes";

// 옷가게 (SHOP-08): 고른 옷·모자·소품을 한 번에 사서 입는다

export type OutfitState = { ok: boolean; message: string } | null;

export async function outfitAction(_prev: OutfitState, formData: FormData): Promise<OutfitState> {
  const member = await requireMember();
  const outfit = parseOutfit({ clothes: formData.get("clothes"), hat: formData.get("hat"), accessory: formData.get("accessory") });
  const pay = parsePay(formData.get("pay"));
  if (!outfit || pay === null) return { ok: false, message: CLOTHES_ERRORS.invalid };
  const result = await applyOutfit(member.userId, outfit, pay);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/", "layout");
  return { ok: true, message: outfitMessage(result.bought, result.total) };
}
