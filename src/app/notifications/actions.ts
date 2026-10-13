"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseId } from "@/lib/ids";
import { notificationHref, parseLevel } from "@/lib/notifications";
import { requireMember } from "@/server/dal";
import { dismissLevelUps, markAllNotificationsRead as markAll, readNotification } from "@/server/notifications";

// 알림함 (GAME-08)·레벨업 팝업 (GAME-06). 모두 `user_id = 나` 조건으로만 바꾼다.

/** 알림 한 줄: 읽음으로 하고 그 글(댓글·답글은 댓글 자리, 레벨업은 경험치·코인 내역)로. 남의 알림·이상한 값이면 알림함으로 돌아간다. */
export async function openNotification(formData: FormData): Promise<void> {
  const member = await requireMember();
  const id = parseId(formData.get("id"));
  const target = id === null ? null : await readNotification(member.userId, id);
  revalidatePath("/", "layout");
  if (!target) redirect("/notifications");
  redirect(target.kind === "level_up" ? "/wallet" : notificationHref(target.kind, target.blogSlug, target.postId));
}

export async function markAllNotificationsRead(): Promise<void> {
  const member = await requireMember();
  await markAll(member.userId);
  revalidatePath("/", "layout");
}

/**
 * 레벨업 팝업 [확인]·[상점 가기]·Esc (GAME-06): 그 레벨 이하의 내 안 읽은 레벨업을 모두 읽음으로.
 * 레벨이 2~99가 아니거나 `go`가 이상하면 아무것도 바꾸지 않는다. `go = shop`이면 상점으로.
 */
export async function dismissLevelUp(formData: FormData): Promise<void> {
  const member = await requireMember();
  const level = parseLevel(formData.get("level"));
  const go = formData.get("go");
  if (level === null || (go !== "stay" && go !== "shop")) return;
  await dismissLevelUps(member.userId, level);
  revalidatePath("/", "layout");
  if (go === "shop") redirect("/shop");
}
