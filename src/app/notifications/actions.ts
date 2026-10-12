"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseId } from "@/lib/ids";
import { notificationHref } from "@/lib/notifications";
import { requireMember } from "@/server/dal";
import { markAllNotificationsRead as markAll, readNotification } from "@/server/notifications";

// 알림함 (GAME-08). 모두 `user_id = 나` 조건으로만 바꾼다.

/** 알림 한 줄: 읽음으로 하고 그 글(댓글·답글은 댓글 자리)로. 남의 알림·이상한 값이면 알림함으로 돌아간다. */
export async function openNotification(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  const target = id === null ? null : await readNotification(member.userId, id);
  revalidatePath("/", "layout");
  redirect(target ? notificationHref(target.kind, target.blogSlug, target.postId) : "/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  const member = await requireMember();
  await markAll(member.userId);
  revalidatePath("/", "layout");
}
