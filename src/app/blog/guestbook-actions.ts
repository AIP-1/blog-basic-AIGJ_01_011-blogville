"use server";

import { revalidatePath } from "next/cache";
import { checkComment } from "@/lib/comment-rules";
import { GUESTBOOK_ERRORS } from "@/lib/guestbook-rules";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { createEntry, editEntry, removeEntry, removeReply, setReply } from "@/server/guestbook";

// 방명록 (BLOG-10, specs/056-guestbook). 누가 하는지는 로그인 세션으로만 정한다: 폼에서는 ID와 내용만 받는다.
// 내용 규칙은 댓글과 같다 (1~1000자, checkComment). 실패하면 문구만 돌려주고 입력은 화면에 남는다.

export type GuestbookResult = { ok: true } | { ok: false; error: string };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** 🔒 비밀글 체크: `"true"`일 때만 켠다 */
const secret = (formData: FormData) => formData.get("isSecret") === "true";

/** 방명록 글 쓰기. 어느 블로그인지(`blogId`)는 서버가 다시 확인한다 */
export async function addGuestbookEntry(formData: FormData): Promise<GuestbookResult> {
  const member = await requireMember();
  const blogId = parseId(formData.get("blogId"));
  if (blogId === null) return { ok: false, error: GUESTBOOK_ERRORS.invalid };
  const checked = checkComment(text(formData, "content"));
  if (!checked.ok) return checked;
  const result = await createEntry(member.userId, blogId, checked.content, secret(formData));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 내 방명록 글 고치기. 남의 글·이상한 ID는 `수정할 수 있는 방명록 글이 없어요`, 아무것도 바꾸지 않는다 */
export async function updateGuestbookEntry(formData: FormData): Promise<GuestbookResult> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  if (id === null) return { ok: false, error: GUESTBOOK_ERRORS.invalid };
  const checked = checkComment(text(formData, "content"));
  if (!checked.ok) return checked;
  const result = await editEntry(member.userId, id, checked.content, secret(formData));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 주인 답글 달기·고치기. 주인이 아니거나 이상한 ID면 `답글을 달 방명록 글이 없어요` */
export async function replyGuestbookEntry(formData: FormData): Promise<GuestbookResult> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  if (id === null) return { ok: false, error: GUESTBOOK_ERRORS.invalid };
  const checked = checkComment(text(formData, "content"));
  if (!checked.ok) return checked;
  const result = await setReply(member.userId, id, checked.content);
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** 방명록 글 삭제 (작성자·주인·관리자). 권한이 없거나 이상한 ID면 아무것도 바꾸지 않는다 (문구 없음) */
export async function deleteGuestbookEntry(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  if (id === null) return;
  if (await removeEntry(member, id)) revalidatePath("/", "layout");
}

/** 주인 답글 삭제 (주인·관리자) */
export async function deleteGuestbookReply(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  if (id === null) return;
  if (await removeReply(member, id)) revalidatePath("/", "layout");
}
