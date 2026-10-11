"use server";

import { revalidatePath } from "next/cache";
import { checkComment, COMMENT_ERRORS } from "@/lib/comment-rules";
import { parseId } from "@/lib/ids";
import { createComment, createReply, removeComment, removeReply } from "@/server/comments";
import { requireMember } from "@/server/dal";

// 댓글·답글 (SOC-01·02, specs/004-comments). 실패하면 문구만 돌려주고 입력은 화면에 남는다.

export type CommentResult = { ok: true } | { ok: false; error: string };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function addComment(formData: FormData): Promise<CommentResult> {
  const member = await requireMember();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return { ok: false, error: COMMENT_ERRORS.invalid };
  const checked = checkComment(text(formData, "content"));
  if (!checked.ok) return checked;
  const result = await createComment(member.userId, postId, checked.content);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function addReply(formData: FormData): Promise<CommentResult> {
  const member = await requireMember();
  const postId = parseId(formData.get("postId"));
  const commentId = parseId(formData.get("commentId"));
  if (postId === null || commentId === null) return { ok: false, error: COMMENT_ERRORS.invalid };
  const checked = checkComment(text(formData, "content"));
  if (!checked.ok) return checked;
  const result = await createReply(member.userId, postId, commentId, checked.content);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 지울 권한이 없거나 이상한 ID면 아무것도 바꾸지 않는다 (문구 없음) */
export async function deleteComment(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  if (id === null) return;
  if ((await removeComment(member, id)) !== null) revalidatePath("/", "layout");
}

export async function deleteReply(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  if (id === null) return;
  if ((await removeReply(member, id)) !== null) revalidatePath("/", "layout");
}
