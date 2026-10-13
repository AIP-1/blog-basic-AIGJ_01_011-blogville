"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  ADMIN_ERRORS,
  parseBannedWords,
  parseContentRefs,
  parseContentTab,
  parseNotice,
  parseReason,
  parseSuspendDays,
  type AdminResult,
} from "@/lib/admin-rules";
import { parseId } from "@/lib/ids";
import {
  blindPost,
  deleteContent,
  forceDeleteMember,
  saveBannedWords,
  setMemberRole,
  setNotice,
  suspendMember,
  unblindPost,
  unsuspendMember,
} from "@/server/admin-tools";
import { requireAdmin } from "@/server/dal";

// 관리자 회원·콘텐츠·사이트 관리 (ADM-01~06, specs/058-admin-tools).
// 모두 첫 줄에서 관리자인지 본다: 아니면 404로 끝나고 아무것도 바꾸지 않는다. 바꾼 일은 관리 기록에 남는다 (server/admin-tools.ts).

const userIdSchema = z.string().min(1).max(64);
const roleSchema = z.enum(["admin", "user"]);

const userIdOf = (formData: FormData) => {
  const parsed = userIdSchema.safeParse(formData.get("userId"));
  return parsed.success ? parsed.data : null;
};

function done(result: AdminResult): AdminResult {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function adminSuspend(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const userId = userIdOf(formData);
  if (!userId) return { ok: false, error: ADMIN_ERRORS.notFound };
  const days = parseSuspendDays(formData.get("days"));
  if (days === null) return { ok: false, error: ADMIN_ERRORS.days };
  const reason = parseReason(formData.get("reason"));
  if (!reason) return { ok: false, error: ADMIN_ERRORS.reason };
  return done(await suspendMember(admin.userId, userId, days, reason));
}

export async function adminUnsuspend(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const userId = userIdOf(formData);
  if (!userId) return { ok: false, error: ADMIN_ERRORS.notFound };
  return done(await unsuspendMember(admin.userId, userId));
}

export async function adminSetRole(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const userId = userIdOf(formData);
  const role = roleSchema.safeParse(formData.get("role"));
  if (!userId || !role.success) return { ok: false, error: ADMIN_ERRORS.invalid };
  return done(await setMemberRole(admin.userId, userId, role.data));
}

/** 강제 탈퇴: 회원 탈퇴와 같은 정리 (나 자신·관리자는 거절) */
export async function adminForceDelete(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const userId = userIdOf(formData);
  if (!userId) return { ok: false, error: ADMIN_ERRORS.notFound };
  return done(await forceDeleteMember(admin.userId, userId));
}

export async function adminBlindPost(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return { ok: false, error: ADMIN_ERRORS.postNotFound };
  const reason = parseReason(formData.get("reason"));
  if (!reason) return { ok: false, error: ADMIN_ERRORS.reason };
  return done(await blindPost(admin.userId, postId, reason));
}

export async function adminUnblindPost(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return { ok: false, error: ADMIN_ERRORS.postNotFound };
  return done(await unblindPost(admin.userId, postId));
}

/** 콘텐츠 선택 삭제 (ADM-02): `tab`과 고른 항목들(`items` = `comment:12` …) */
export async function adminDeleteContent(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const tab = parseContentTab(formData.get("tab"));
  const refs = parseContentRefs(tab, formData.getAll("items"));
  if (!refs) return { ok: false, error: formData.getAll("items").length === 0 ? ADMIN_ERRORS.noneSelected : ADMIN_ERRORS.invalid };
  const removed = await deleteContent(admin, refs);
  return done({
    ok: true,
    message: removed === refs.length ? `${removed}개를 삭제했어요` : `${removed}개를 삭제했어요 (이미 지워진 ${refs.length - removed}개는 건너뜀)`,
  });
}

/** 사이트 공지 띠 (ADM-04) */
export async function adminSaveNotice(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = parseNotice({ text: formData.get("text"), link: formData.get("link"), enabled: formData.get("enabled") });
  if (!parsed.ok) return parsed;
  return done(await setNotice(admin.userId, parsed.value));
}

/** 금지어 (ADM-05) */
export async function adminSaveBannedWords(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const parsed = parseBannedWords(formData.get("words"));
  if (!parsed.ok) return parsed;
  return done(await saveBannedWords(admin.userId, parsed.words));
}
