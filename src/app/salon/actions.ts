"use server";

import { revalidatePath } from "next/cache";
import { parsePay } from "@/lib/clothes";
import { parseStyle, SALON_ERRORS, styleMessage } from "@/lib/salon";
import { requireMember } from "@/server/dal";
import { applyStyle } from "@/server/salon";

// 미용실 (SHOP-07): 고른 머리 모양·머리 색을 한 번에 사서 바꾼다

export type StyleState = { ok: boolean; message: string } | null;

export async function styleAction(_prev: StyleState, formData: FormData): Promise<StyleState> {
  const member = await requireMember();
  const style = parseStyle({ hair: formData.get("hair"), hair_color: formData.get("hair_color") });
  const pay = parsePay(formData.get("pay"));
  if (!style || pay === null) return { ok: false, message: SALON_ERRORS.invalid };
  const result = await applyStyle(member.userId, style, pay);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/", "layout");
  return { ok: true, message: styleMessage(result.paid, result.total) };
}
