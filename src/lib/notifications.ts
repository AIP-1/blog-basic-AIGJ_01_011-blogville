import { formatDate } from "./text";

// 알림함 문구·주소·시간 (GAME-08, specs/017-notifications). 서버와 화면이 같이 쓴다.

export type NotificationKind = "like" | "comment" | "reply";

export const NOTIFICATIONS_PAGE_SIZE = 20;
/** 헤더 숫자는 10개까지만 센다 (`9+`) */
export const UNREAD_COUNT_CAP = 10;

export const NOTIFICATION_EMPTY = "아직 알림이 없어요";

/** 헤더 🔔 빨간 숫자: 없으면 null, 1~9, 10개 이상은 `9+` */
export function unreadBadge(count: number): string | null {
  if (!Number.isFinite(count) || count < 1) return null;
  return count > 9 ? "9+" : String(Math.floor(count));
}

export function notificationText(kind: NotificationKind, nickname: string, postTitle: string): string {
  switch (kind) {
    case "like":
      return `❤️ ${nickname}님이 「${postTitle}」에 공감했어요`;
    case "comment":
      return `💬 ${nickname}님이 「${postTitle}」에 댓글을 달았어요`;
    case "reply":
      return `💬 ${nickname}님이 내 댓글에 답글을 달았어요`;
  }
}

/** 누르면 갈 곳: 공감은 그 글, 댓글·답글은 그 글의 댓글 자리 */
export function notificationHref(kind: NotificationKind, blogSlug: string, postId: number): string {
  const post = `/@${blogSlug}/${postId}`;
  return kind === "like" ? post : `${post}#comments`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** `방금` / `N분 전` / `N시간 전` / 하루가 지나면 `2026.10.02` (한국 시간) */
export function notificationTime(createdAt: Date, now: Date = new Date()): string {
  const diff = now.getTime() - createdAt.getTime();
  if (diff < MINUTE) return "방금";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}시간 전`;
  return formatDate(createdAt);
}

export function isNotificationKind(value: string): value is NotificationKind {
  return value === "like" || value === "comment" || value === "reply";
}
