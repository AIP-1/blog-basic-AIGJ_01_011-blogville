import { safeNext } from "./safe-next";
import { codePointLength } from "./text";

// 버그·문의 규칙 (SUP-01~04, specs/057-support). 브라우저·서버·자동 처리 API가 같이 쓰는 순수 함수만 둔다.

export const FEEDBACK_KINDS = ["bug", "question"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_STATUSES = ["new", "in_progress", "answered", "fixed"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_KIND_LABELS: Record<FeedbackKind, string> = { bug: "🐞 버그", question: "💬 문의" };
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = { new: "접수", in_progress: "확인 중", answered: "답변 완료", fixed: "고침" };

export const FEEDBACK_TITLE_MAX = 100;
export const FEEDBACK_CONTENT_MAX = 2000;
export const FEEDBACK_REPLY_MAX = 2000;
/** 저장하는 브라우저 정보(User-Agent)의 최대 길이 */
export const USER_AGENT_MAX = 300;
/** 내 문의 한 쪽에 보이는 수 */
export const FEEDBACK_PAGE_SIZE = 10;
/** 관리자 화면 한 쪽에 보이는 수 */
export const ADMIN_FEEDBACK_PAGE_SIZE = 20;
/** 한 회원이 한 시간에 보낼 수 있는 문의 수 */
export const FEEDBACK_RATE_LIMIT = 5;
export const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000;
/** 자동 처리 API 목록의 기본·최대 개수 */
export const BOT_LIST_DEFAULT = 50;
export const BOT_LIST_MAX = 100;

export const FEEDBACK_SENT = "접수했어요. 답변이 달리면 알림으로 알려 드릴게요";

export const FEEDBACK_ERRORS = {
  invalid: "잘못된 요청이에요",
  kind: "종류를 골라 주세요",
  titleEmpty: "제목을 입력해 주세요",
  titleTooLong: `제목은 ${FEEDBACK_TITLE_MAX}자까지 쓸 수 있어요`,
  contentEmpty: "내용을 입력해 주세요",
  contentTooLong: `내용은 ${FEEDBACK_CONTENT_MAX}자까지 쓸 수 있어요`,
  replyTooLong: `답변은 ${FEEDBACK_REPLY_MAX}자까지 쓸 수 있어요`,
  status: "상태를 골라 주세요",
  rateLimited: `문의는 한 시간에 ${FEEDBACK_RATE_LIMIT}번까지 보낼 수 있어요. 잠시 뒤 다시 보내 주세요`,
  notFound: "문의를 찾을 수 없어요",
} as const;

export function isFeedbackKind(value: unknown): value is FeedbackKind {
  return typeof value === "string" && (FEEDBACK_KINDS as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

/** 줄바꿈을 `\n`으로 맞추고 앞뒤 공백을 뗀다 */
function clean(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").trim();
}

export type FeedbackInput = { kind: FeedbackKind; title: string; content: string };

/** 문의 쓰기 칸 검사: 종류, 제목 1~100자(한 줄), 내용 1~2000자. 글자 수는 이모지도 1자로 센다 */
export function checkFeedback(raw: { kind: unknown; title: unknown; content: unknown }): { ok: true; value: FeedbackInput } | { ok: false; error: string } {
  if (!isFeedbackKind(raw.kind)) return { ok: false, error: FEEDBACK_ERRORS.kind };
  if (typeof raw.title !== "string" || typeof raw.content !== "string") return { ok: false, error: FEEDBACK_ERRORS.invalid };
  const title = clean(raw.title).replace(/\s+/g, " ");
  const content = clean(raw.content);
  if (title.length === 0) return { ok: false, error: FEEDBACK_ERRORS.titleEmpty };
  if (codePointLength(title) > FEEDBACK_TITLE_MAX) return { ok: false, error: FEEDBACK_ERRORS.titleTooLong };
  if (content.length === 0) return { ok: false, error: FEEDBACK_ERRORS.contentEmpty };
  if (codePointLength(content) > FEEDBACK_CONTENT_MAX) return { ok: false, error: FEEDBACK_ERRORS.contentTooLong };
  return { ok: true, value: { kind: raw.kind, title, content } };
}

/**
 * 답변 검사: 앞뒤 공백을 떼고 2000자까지. 빈 글자는 `""`로 돌려준다
 * (관리자 화면에서는 답변 지우기, 자동 처리 API는 받지 않는다).
 */
export function checkReply(raw: string): { ok: true; reply: string } | { ok: false; error: string } {
  const reply = clean(raw);
  if (codePointLength(reply) > FEEDBACK_REPLY_MAX) return { ok: false, error: FEEDBACK_ERRORS.replyTooLong };
  return { ok: true, reply };
}

/** 문의를 쓰기 전에 보던 주소 (`?from=`): 이 사이트 안의 `/…` 주소만, 아니면 null. 문의 화면 자신도 남기지 않는다 */
export function feedbackPagePath(value: unknown): string | null {
  const path = safeNext(value);
  if (path === null) return null;
  return path === "/support" || path.startsWith("/support?") || path.startsWith("/support#") ? null : path;
}

/** 저장할 브라우저 정보: 제어 문자를 빼고 300자까지, 비면 null */
export function truncateUserAgent(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (text.length === 0) return null;
  return [...text].slice(0, USER_AGENT_MAX).join("");
}

/** 보내기 제한을 세는 구간의 시작: 지금부터 한 시간 전 (그 뒤에 쓴 문의만 센다) */
export function rateWindowStart(now: Date): Date {
  return new Date(now.getTime() - FEEDBACK_RATE_WINDOW_MS);
}

/** 한 시간 안에 이미 보낸 수가 제한에 닿았는지 (5번 보냈으면 6번째는 막는다) */
export function isRateLimited(sentInWindow: number): boolean {
  return sentInWindow >= FEEDBACK_RATE_LIMIT;
}

/** 문의 하나를 바꾸는 요청 (관리자 화면·자동 처리 API). 없는 칸은 그대로 둔다. reply가 `""`이면 답변을 지운다 */
export type FeedbackChange = { status?: FeedbackStatus; reply?: string };

/**
 * 바꾼 뒤의 상태: 상태를 정해 보냈으면 그 값.
 * 상태 없이 새 답변만 달았는데 아직 `접수`·`확인 중`이면 `답변 완료`로 올린다.
 */
export function nextStatus(current: FeedbackStatus, change: FeedbackChange): FeedbackStatus {
  if (change.status) return change.status;
  if (change.reply && (current === "new" || current === "in_progress")) return "answered";
  return current;
}

/**
 * 쓴 사람에게 `🐞 문의에 답변이 달렸어요` 알림을 보낼지 (SUP-03·04):
 * 새 답변이 달렸거나 답변이 바뀌었을 때, 또는 상태가 `답변 완료`·`고침`으로 바뀌었을 때. 한 번 바꿀 때 알림은 하나.
 */
export function shouldNotifyReply(
  before: { status: FeedbackStatus; reply: string | null },
  after: { status: FeedbackStatus; reply: string | null },
): boolean {
  const replied = after.reply !== null && after.reply !== before.reply;
  const settled = after.status !== before.status && (after.status === "answered" || after.status === "fixed");
  return replied || settled;
}

/** 자동 처리 API의 `?status=new,in_progress`: 쉼표로 나눈 상태들. 비면 전체, 모르는 값이 있으면 null */
export function parseStatusList(value: string | null): FeedbackStatus[] | null {
  if (value === null || value.trim() === "") return [...FEEDBACK_STATUSES];
  const parts = value.split(",").map((s) => s.trim());
  if (!parts.every(isFeedbackStatus)) return null;
  return [...new Set(parts)];
}

/** 자동 처리 API의 `?limit=`: 1~100 정수, 없으면 50, 이상하면 null */
export function parseLimit(value: string | null): number | null {
  if (value === null || value === "") return BOT_LIST_DEFAULT;
  if (!/^[1-9][0-9]{0,2}$/.test(value)) return null;
  const n = Number(value);
  return n <= BOT_LIST_MAX ? n : null;
}

/** 버그·문의하기 버튼의 주소: 지금 보는 주소를 `?from=`으로 넘긴다. 문의 화면에서는 붙이지 않는다 */
export function supportHref(pathname: string): string {
  const from = feedbackPagePath(pathname);
  return from ? `/support?from=${encodeURIComponent(from)}` : "/support";
}
