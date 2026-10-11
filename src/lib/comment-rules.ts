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
} as const;

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
