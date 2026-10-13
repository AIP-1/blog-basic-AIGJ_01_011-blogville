"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { blogs, users } from "@/db/schema";
import { parseId } from "@/lib/ids";
import { makeTempPassword } from "@/lib/temp-password";
import { RESET_ERRORS, resetMemberPassword, type ResetResult } from "@/server/account";
import { checkReply, FEEDBACK_ERRORS, FEEDBACK_STATUS_LABELS, isFeedbackStatus } from "@/lib/support-rules";
import { adminRemovePost, auditFeedback, writeAudit } from "@/server/admin-tools";
import { requireAdmin } from "@/server/dal";
import { updateFeedback } from "@/server/feedback";

/** 관리자 글 삭제 (AUTH-08): 어느 블로그의 글이든 지운다. 일반 회원이 보내면 404로 끝나고 아무것도 지우지 않는다. */
export async function adminDeletePost(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return;
  await adminRemovePost(admin.userId, postId);
  revalidatePath("/", "layout");
}

/**
 * 글 화면의 관리자 [삭제] (AUTH-08 열린 질문): `/admin` 최근 글에 없는 오래된 글도 지운다.
 * 지운 글 화면은 404라 그 블로그 홈으로 보낸다. 이미 지워진 글이면 다시 그리기만 한다.
 */
export async function adminDeletePostAndLeave(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return;
  const blogId = await adminRemovePost(admin.userId, postId);
  revalidatePath("/", "layout");
  if (blogId === null) return;
  const [blog] = await db.select({ slug: blogs.slug }).from(blogs).where(eq(blogs.id, blogId));
  if (blog) redirect(`/@${blog.slug}`);
}

/**
 * 관리자 비밀번호 초기화 (AUTH-07 열린 질문): 임시 비밀번호를 만들어 한 번만 화면에 돌려준다.
 * 일반 회원이 보내면 404로 끝나고 아무것도 바꾸지 않는다. 관리자 계정은 거절한다.
 */
export async function adminResetPassword(formData: FormData): Promise<ResetResult> {
  const admin = await requireAdmin();
  const userId = formData.get("userId");
  if (typeof userId !== "string" || userId.length < 1 || userId.length > 64) return { ok: false, error: RESET_ERRORS.notFound };
  const result = await resetMemberPassword(userId, makeTempPassword());
  if (result.ok) {
    const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId));
    // 관리 기록에는 임시 비밀번호를 남기지 않는다
    await writeAudit(db, admin.userId, "reset_password", { type: "member", id: userId, label: user?.username ?? userId });
  }
  return result;
}

export type FeedbackAdminResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * 관리자 문의 처리 (SUP-03): 상태와 답변을 저장한다. 답변 칸을 비우면 답변을 지운다.
 * 상태를 바꾸지 않고 새 답변만 달면 `접수`·`확인 중`은 `답변 완료`가 된다.
 * 새 답변이 달리거나 `답변 완료`·`고침`이 되면 쓴 사람에게 알림이 간다. 일반 회원이 보내면 404로 끝나고 아무것도 바꾸지 않는다.
 */
export async function adminUpdateFeedback(_prev: FeedbackAdminResult | null, formData: FormData): Promise<FeedbackAdminResult> {
  const admin = await requireAdmin();
  const id = parseId(formData.get("id"));
  const status = formData.get("status");
  const rawReply = formData.get("reply");
  if (id === null || typeof rawReply !== "string") return { ok: false, error: FEEDBACK_ERRORS.invalid };
  if (!isFeedbackStatus(status)) return { ok: false, error: FEEDBACK_ERRORS.status };
  const reply = checkReply(rawReply);
  if (!reply.ok) return reply;
  // 상태를 그대로 두고 새 답변만 달면 `답변 완료`로 올린다 (nextStatus). 화면이 열릴 때의 상태와 같으면 고르지 않은 것으로 본다
  const picked = status === formData.get("prevStatus") ? undefined : status;
  const updated = await updateFeedback(id, { status: picked, reply: reply.reply }, "admin");
  if (!updated) return { ok: false, error: FEEDBACK_ERRORS.notFound };
  await auditFeedback(admin.userId, id, FEEDBACK_STATUS_LABELS[updated.status], updated.reply);
  revalidatePath("/", "layout");
  return { ok: true, message: updated.notified ? "저장했어요. 쓴 사람에게 알림을 보냈어요" : "저장했어요" };
}
