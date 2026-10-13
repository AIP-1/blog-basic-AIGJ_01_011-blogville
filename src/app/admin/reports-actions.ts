"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ERRORS, parseReason, type AdminResult } from "@/lib/admin-rules";
import { parseReportTarget } from "@/lib/report-rules";
import { requireAdmin } from "@/server/dal";
import { blindReportedPost, deleteReported, dismissReports } from "@/server/reports";

// 관리자 신고 처리 (specs/059-report-bookmarks). 모두 첫 줄에서 관리자인지 본다: 아니면 404로 끝나고 아무것도 바꾸지 않는다.
// 블라인드·삭제는 콘텐츠 관리와 같은 함수를 쓰고(관리 기록 포함), 그 대상의 신고를 모두 처리됨으로 닫는다. 기각은 신고만 닫는다.

function done(result: AdminResult): AdminResult {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

const targetOf = (formData: FormData) => parseReportTarget(formData.get("targetType"), formData.get("targetId"));

export async function adminReportBlind(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const target = targetOf(formData);
  if (!target || target.targetType !== "post") return { ok: false, error: ADMIN_ERRORS.invalid };
  const reason = parseReason(formData.get("reason"));
  if (!reason) return { ok: false, error: ADMIN_ERRORS.reason };
  return done(await blindReportedPost(admin.userId, target.targetId, reason));
}

export async function adminReportDelete(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const target = targetOf(formData);
  if (!target) return { ok: false, error: ADMIN_ERRORS.invalid };
  return done(await deleteReported(admin, target.targetType, target.targetId));
}

export async function adminReportDismiss(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const target = targetOf(formData);
  if (!target) return { ok: false, error: ADMIN_ERRORS.invalid };
  return done(await dismissReports(admin.userId, target.targetType, target.targetId));
}
