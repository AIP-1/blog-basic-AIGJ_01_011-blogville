"use server";

import { revalidatePath } from "next/cache";
import { FARM_ERRORS, isCareAction } from "@/lib/farm";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { buyEgg, careAnimal, claimEgg, hatchEgg, type FarmResult } from "@/server/farm";

// 동물 농장 (TOWN-09). 버튼 하나가 폼 하나다. 화면 버튼을 우회해도 서버가 다시 확인한다.

export type FarmState = { ok: boolean; message: string } | null;

function done(result: FarmResult): FarmState {
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/", "layout");
  return { ok: true, message: result.message };
}

/** `intent`: `claim`(egg = "first" | 레벨), `buy`, `hatch`(id), `care`(id, action) */
export async function farmAction(_prev: FarmState, formData: FormData): Promise<FarmState> {
  const member = await requireMember();
  const intent = formData.get("intent");
  if (intent === "claim") {
    const egg = formData.get("egg");
    const level = parseId(egg);
    if (egg !== "first" && level === null) return { ok: false, message: FARM_ERRORS.notYet };
    return done(await claimEgg(member.userId, egg === "first" ? "first" : level!));
  }
  if (intent === "buy") return done(await buyEgg(member.userId));
  const id = parseId(formData.get("id"));
  if (intent === "hatch") return id === null ? { ok: false, message: FARM_ERRORS.notEgg } : done(await hatchEgg(member.userId, id));
  if (intent === "care") {
    const action = formData.get("action");
    if (id === null || !isCareAction(action)) return { ok: false, message: FARM_ERRORS.notAnimal };
    return done(await careAnimal(member.userId, id, action));
  }
  return { ok: false, message: FARM_ERRORS.notAnimal };
}
