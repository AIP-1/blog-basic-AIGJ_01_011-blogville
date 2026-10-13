"use server";

import { revalidatePath } from "next/cache";
import { parseReport, type ReportResult } from "@/lib/report-rules";
import { requireMember } from "@/server/dal";
import { createReport } from "@/server/reports";

// 🚨 신고하기 (specs/059-report-bookmarks). 신고자는 로그인 세션으로만 정한다: 폼에서는 대상 종류·ID·사유·설명만 받는다.
// 볼 수 없는 것·내 것·이상한 값은 거절하고, 같은 대상을 또 신고하면 `이미 신고했어요` (한 회원 한 대상 한 번).

export async function reportContent(formData: FormData): Promise<ReportResult> {
  const member = await requireMember();
  const parsed = parseReport({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    detail: formData.get("detail"),
  });
  if (!parsed.ok) return parsed;
  const result = await createReport(member, parsed.value);
  // 관리자 대시보드의 신고 수
  if (result.ok) revalidatePath("/admin", "layout");
  return result;
}
