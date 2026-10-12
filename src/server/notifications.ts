import "server-only";
import { and, count, desc, eq, isNull, lte, max, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { blogs, notifications, posts, profiles } from "@/db/schema";
import { levelsGained } from "@/lib/game";
import { isActivityKind, NOTIFICATIONS_PAGE_SIZE, UNREAD_COUNT_CAP, type ActivityKind } from "@/lib/notifications";

// 알림 (GAME-08의 공감·댓글·답글, specs/017-notifications · GAME-06 레벨업, specs/034-level-up)

/**
 * 공감·댓글·답글을 저장하는 트랜잭션 안에서 부른다.
 * 받는 사람이 없거나(원댓글 작성자가 탈퇴) 나 자신이면 넣지 않는다.
 * 공감은 같은 사람·같은 글에 한 번만(부분 고유 인덱스 notifications_like_uq).
 */
export async function notifyActivity(
  tx: Tx,
  n: { kind: ActivityKind; recipientId: string | null; actorId: string; postId: number },
): Promise<void> {
  if (!n.recipientId || n.recipientId === n.actorId) return;
  await tx
    .insert(notifications)
    .values({ userId: n.recipientId, kind: n.kind, actorId: n.actorId, postId: n.postId })
    .onConflictDoNothing();
}

/**
 * 레벨업 알림 (GAME-06): 누적 경험치가 before → after가 되며 오른 레벨마다 한 줄. 원장을 넣은 트랜잭션 안에서 부른다.
 * 같은 레벨은 한 번만 (부분 고유 인덱스 notifications_level_up_uq).
 */
export async function notifyLevelUps(tx: Tx, userId: string, before: number, after: number): Promise<void> {
  const levels = levelsGained(before, after);
  if (levels.length === 0) return;
  await tx
    .insert(notifications)
    .values(levels.map((level) => ({ userId, kind: "level_up", level })))
    .onConflictDoNothing();
}

/** 받는 사람이 지금 볼 수 있는 알림만: 레벨업, 그리고 글이 공개이거나 내 글인 활동 알림 (답글 알림의 글이 나중에 비공개가 되면 숨긴다) */
const visibleTo = (userId: string) =>
  and(eq(notifications.userId, userId), or(eq(notifications.kind, "level_up"), eq(posts.isPublic, true), eq(blogs.ownerId, userId)));

/** 헤더 🔔: 안 읽은 알림 수. UNREAD_COUNT_CAP에서 멈춘다 (`9+`) */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const unread = db
    .select({ one: sql`1` })
    .from(notifications)
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .leftJoin(blogs, eq(blogs.id, posts.blogId))
    .where(and(visibleTo(userId), isNull(notifications.readAt)))
    .limit(UNREAD_COUNT_CAP)
    .as("unread");
  const [row] = await db.select({ n: count() }).from(unread);
  return row.n;
}

/** 헤더 팝업 (GAME-06): 안 읽은 레벨업 중 가장 높은 레벨. 없으면 null */
export async function getPendingLevelUp(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ level: max(notifications.level) })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, "level_up"), isNull(notifications.readAt)));
  return row?.level ?? null;
}

/** 팝업 [확인]: 그 레벨과 그보다 낮은 내 안 읽은 레벨업을 모두 읽음으로 */
export async function dismissLevelUps(userId: string, level: number): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, userId), eq(notifications.kind, "level_up"), lte(notifications.level, level), isNull(notifications.readAt)));
}

export type NotificationItem = { id: number; createdAt: Date; read: boolean } & (
  | { kind: ActivityKind; nickname: string; postId: number; postTitle: string; blogSlug: string }
  | { kind: "level_up"; level: number }
);

/** 알림함: 최신순 20개씩, 닉네임·글 제목·블로그 주소는 지금 값으로 */
export async function listNotifications(userId: string, page: number): Promise<{ items: NotificationItem[]; total: number }> {
  const where = visibleTo(userId);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        level: notifications.level,
        nickname: profiles.nickname,
        postId: posts.id,
        postTitle: posts.title,
        blogSlug: blogs.slug,
        createdAt: notifications.createdAt,
        readAt: notifications.readAt,
      })
      .from(notifications)
      .leftJoin(posts, eq(posts.id, notifications.postId))
      .leftJoin(blogs, eq(blogs.id, posts.blogId))
      .leftJoin(profiles, eq(profiles.userId, notifications.actorId))
      .where(where)
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(NOTIFICATIONS_PAGE_SIZE)
      .offset((page - 1) * NOTIFICATIONS_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(notifications)
      .leftJoin(posts, eq(posts.id, notifications.postId))
      .leftJoin(blogs, eq(blogs.id, posts.blogId))
      .where(where),
  ]);
  const items = rows.flatMap(({ id, kind, level, nickname, postId, postTitle, blogSlug, createdAt, readAt }): NotificationItem[] => {
    const base = { id, createdAt, read: readAt !== null };
    if (kind === "level_up" && level !== null) return [{ ...base, kind, level }];
    if (isActivityKind(kind) && nickname !== null && postId !== null && postTitle !== null && blogSlug !== null) {
      return [{ ...base, kind, nickname, postId, postTitle, blogSlug }];
    }
    return [];
  });
  return { items, total };
}

export type NotificationTarget = { kind: ActivityKind; blogSlug: string; postId: number } | { kind: "level_up" };

/** 내 알림 하나를 읽음으로 하고 갈 곳을 돌려준다. 남의 알림·없는 알림·볼 수 없는 글이면 null (아무것도 바꾸지 않음) */
export async function readNotification(userId: string, id: number): Promise<NotificationTarget | null> {
  const [row] = await db
    .select({ kind: notifications.kind, blogSlug: blogs.slug, postId: posts.id })
    .from(notifications)
    .leftJoin(posts, eq(posts.id, notifications.postId))
    .leftJoin(blogs, eq(blogs.id, posts.blogId))
    .where(and(eq(notifications.id, id), visibleTo(userId)));
  if (!row) return null;
  let target: NotificationTarget;
  if (row.kind === "level_up") target = { kind: "level_up" };
  else if (isActivityKind(row.kind) && row.blogSlug !== null && row.postId !== null) target = { kind: row.kind, blogSlug: row.blogSlug, postId: row.postId };
  else return null;
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.readAt)));
  return target;
}

/** [모두 읽음]: 내 안 읽은 알림 전부 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
