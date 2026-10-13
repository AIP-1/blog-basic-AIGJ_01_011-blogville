"use server";

import { revalidatePath } from "next/cache";
import { parseId } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { removeBookmark, toggleBookmark as storeBookmark } from "@/server/bookmarks";

// 🔖 스크랩 (specs/059-report-bookmarks). 누가 하는지는 로그인 세션으로만 정한다: 폼에서는 글 ID만 받는다.

/** 글 화면의 [🔖 스크랩]: 스크랩인지 취소인지는 서버가 정한다. 볼 수 없는 글·이상한 ID는 아무것도 하지 않는다 */
export async function toggleBookmark(rawPostId: unknown): Promise<void> {
  const member = await requireMember();
  const postId = parseId(rawPostId);
  if (postId === null) return;
  if ((await storeBookmark(member.userId, postId)) !== null) revalidatePath("/", "layout");
}

/** 🔖 내 스크랩의 [스크랩 취소] */
export async function deleteBookmark(formData: FormData): Promise<void> {
  const member = await requireMember();
  const postId = parseId(formData.get("postId"));
  if (postId === null) return;
  if (await removeBookmark(member.userId, postId)) revalidatePath("/", "layout");
}
