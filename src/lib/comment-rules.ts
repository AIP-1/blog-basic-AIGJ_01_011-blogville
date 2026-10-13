import { codePointLength } from "./text";

// 댓글·답글 규칙 (SOC-01·02). 브라우저와 서버가 같이 쓴다.

export const COMMENT_MAX = 1000;

export const COMMENT_ERRORS = {
  empty: "댓글을 적어 주세요",
  tooLong: "댓글은 1000자까지예요",
  invalid: "잘못된 요청이에요",
  postNotFound: "글을 찾을 수 없어요",
  parentDeleted: "삭제된 댓글에는 답글을 달 수 없어요",
  parentNotFound: "답글을 달 댓글이 없어요",
  editNotFound: "수정할 수 있는 댓글이 없어요",
} as const;

/** 비밀 댓글을 볼 수 없는 사람에게 내용 대신 보이는 한 줄 (SOC-01·02, specs/055-comment-edit-secret) */
export const SECRET_PLACEHOLDER = "🔒 비밀 댓글이에요";

/**
 * 비밀 댓글·답글을 볼 수 있는지. 관리자, 블로그 주인, `authorIds`(그 댓글 작성자, 답글이면 답글 작성자와 원댓글 작성자) 중 하나면 본다.
 * 탈퇴한 작성자(null)는 누구와도 같지 않다. 비밀이 아닌 줄에는 부르지 않는다.
 */
export function canSeeSecret(
  viewer: { userId: string; role: string } | null,
  blogOwnerId: string,
  authorIds: readonly (string | null)[],
): boolean {
  if (!viewer) return false;
  if (viewer.role === "admin" || viewer.userId === blogOwnerId) return true;
  return authorIds.some((id) => id !== null && id === viewer.userId);
}

/** 답글이 가려지는지: 답글이나 원댓글 중 하나라도 비밀이면 비밀 규칙을 따른다 */
export function isReplyHidden(
  viewer: { userId: string; role: string } | null,
  blogOwnerId: string,
  reply: { authorId: string | null; isSecret: boolean },
  parent: { authorId: string | null; isSecret: boolean },
): boolean {
  if (!reply.isSecret && !parent.isSecret) return false;
  return !canSeeSecret(viewer, blogOwnerId, [reply.authorId, parent.authorId]);
}

/** 댓글이 가려지는지: 비밀이고 볼 수 있는 사람이 아니면 */
export function isCommentHidden(
  viewer: { userId: string; role: string } | null,
  blogOwnerId: string,
  comment: { authorId: string | null; isSecret: boolean },
): boolean {
  return comment.isSecret && !canSeeSecret(viewer, blogOwnerId, [comment.authorId]);
}

/** 줄바꿈을 `\n`으로 맞추고 앞뒤 공백을 지운 뒤 1~1000자 (이모지 1개 = 1자) */
export function checkComment(raw: string): { ok: true; content: string } | { ok: false; error: string } {
  const content = raw.replace(/\r\n?/g, "\n").trim();
  if (content.length === 0) return { ok: false, error: COMMENT_ERRORS.empty };
  if (codePointLength(content) > COMMENT_MAX) return { ok: false, error: COMMENT_ERRORS.tooLong };
  return { ok: true, content };
}

const dateTimeFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `2026. 10. 02. 14:07` (한국 시간, 24시간) */
export function formatDateTime(date: Date): string {
  const p = Object.fromEntries(dateTimeFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}. ${p.month}. ${p.day}. ${p.hour}:${p.minute}`;
}
