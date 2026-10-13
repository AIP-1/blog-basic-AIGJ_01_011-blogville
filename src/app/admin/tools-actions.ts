"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_ERRORS, parseBanner, parseReason, parseSuspendDays, type AdminResult } from "@/lib/admin-rules";
import { parseId } from "@/lib/ids";
import { blindPost, setBanner, setMemberRole, suspendMember, unblindPost, unsuspendMember, writeAdminLog } from "@/server/admin-tools";
import { removeComment, removeReply } from "@/server/comments";
import { requireAdmin } from "@/server/dal";
import { db } from "@/db";

// 관리자 회원·글·댓글·사이트 관리 (관리자 보강). 모두 첫 줄에서 관리자인지 본다: 아니면 404로 끝나고 아무것도 바꾸지 않는다.

const userIdOf = (formData: FormData) => {
  const v = formData.get("userId");
  return typeof v === "string" && v.length >= 1 && v.length <= 64 ? v : null;
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
  const role = formData.get("role");
  if (!userId || (role !== "admin" && role !== "user")) return { ok: false, error: ADMIN_ERRORS.notFound };
  return done(await setMemberRole(admin.userId, userId, role));
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

/** 댓글·답글 지우기 (자리는 "삭제된 댓글이에요"로 남는다) */
export async function adminDeleteComment(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const id = parseId(formData.get("id"));
  const kind = formData.get("kind");
  if (id === null || (kind !== "comment" && kind !== "reply")) return { ok: false, error: "댓글을 찾지 못했어요" };
  const removed = kind === "comment" ? await removeComment(admin, id) : await removeReply(admin, id);
  if (removed === null) return { ok: false, error: "이미 지워졌거나 없는 댓글이에요" };
  const summary = String(formData.get("summary") ?? "").slice(0, 100) || `${kind === "comment" ? "댓글" : "답글"} #${id}`;
  await writeAdminLog(db, admin.userId, "delete_comment", summary);
  return done({ ok: true, message: "댓글을 지웠어요" });
}

export async function adminSetBanner(formData: FormData): Promise<AdminResult> {
  const admin = await requireAdmin();
  const text = parseBanner(formData.get("banner"));
  if (text === null) return { ok: false, error: ADMIN_ERRORS.banner };
  return done(await setBanner(admin.userId, text));
}
