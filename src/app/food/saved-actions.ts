"use server";

import { revalidatePath } from "next/cache";
import type { FoodPlace } from "@/lib/food";
import { normalizePlace } from "@/lib/food-review";
import { getSession } from "@/server/dal";
import { toggleSavedPlace as storeSavedPlace } from "@/server/food-saved";

export type SaveResult = { saved: boolean } | { error: "login" | "invalid" | "full" };

/**
 * 🍽 식당 카드의 [☆ 가고 싶어요]. 저장인지 취소인지는 서버가 정한다.
 * 방문자는 로그인 화면으로 보내지 않고 버튼 옆에 로그인 안내를 띄우도록 "login"을 돌려준다.
 */
export async function toggleSavedPlace(place: FoodPlace): Promise<SaveResult> {
  const member = await getSession();
  if (!member) return { error: "login" };
  const clean = normalizePlace(place);
  if (!clean) return { error: "invalid" };
  const saved = await storeSavedPlace(member.userId, clean);
  if (saved === null) return { error: "full" };
  revalidatePath("/food");
  return { saved };
}
