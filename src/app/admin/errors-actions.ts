"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ERRORS, type AdminResult } from "@/lib/admin-rules";
import { parseId } from "@/lib/ids";
import { requireAdmin } from "@/server/dal";
import { resolveError } from "@/server/error-log";

// 서버 오류 기록 (관리자 ⚠️ 오류). 첫 줄에서 관리자인지 본다: 아니면 404.

/** 해결함: 그 오류 묶음을 지운다 (관리 기록에 남는다) */
export async function adminResolveError(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const id = parseId(formData.get("errorId"));
  if (id === null) return { ok: false, error: ADMIN_ERRORS.invalid };
  const removed = await resolveError(admin.userId, id);
  revalidatePath("/admin", "layout");
  return removed ? { ok: true, message: "해결함으로 지웠어요" } : { ok: false, error: "이미 지워진 오류예요" };
}
