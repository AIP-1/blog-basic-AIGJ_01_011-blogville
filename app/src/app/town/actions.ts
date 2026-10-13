"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/server/dal";
import { setTownLot } from "@/server/follows";
import { LOT_ERRORS } from "@/lib/town/lots";

/**
 * ☰ 🏡 이웃 집 자리 (TOWN-18): 즐겨찾기 이웃(`followeeId`)을 `lot`번 자리로. 거절하면 문구를 돌려주고 저장하지 않는다.
 */
export async function chooseTownLot(formData: FormData): Promise<{ error: string | null }> {
  const member = await requireMember();
  const followeeId = formData.get("followeeId");
  const raw = formData.get("lot");
  if (typeof followeeId !== "string" || followeeId.length < 1 || followeeId.length > 64) return { error: LOT_ERRORS.notFavorite };
  const lot = typeof raw === "string" && /^\d{1,2}$/.test(raw) ? Number(raw) : null;
  const error = await setTownLot(member.userId, followeeId, lot);
  if (!error) revalidatePath("/", "layout");
  return { error };
}
