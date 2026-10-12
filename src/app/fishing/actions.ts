"use server";

import { revalidatePath } from "next/cache";
import type { CatchCode } from "@/lib/fishing";
import { requireMember } from "@/server/dal";
import { castLine as cast } from "@/server/fishing";

// 연못 낚시터 (TOWN-14). 무엇을 낚을지는 서버가 정한다.

export type CastState = { ok: true; catch: CatchCode } | { ok: false; message: string } | null;

export async function castLine(): Promise<CastState> {
  const member = await requireMember();
  const result = await cast(member.userId);
  if (!result.ok) return { ok: false, message: result.error };
  revalidatePath("/", "layout");
  return { ok: true, catch: result.catch };
}
