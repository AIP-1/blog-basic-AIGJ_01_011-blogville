// 관리자 회원·콘텐츠·사이트 관리 규칙 (ADM-01~07, specs/058-admin-tools). 서버와 단위 시험이 같이 쓰는 순수 함수만 둔다.
import { z } from "zod";
import { safeNext } from "./safe-next";
import { formatDateTime } from "./time";

export const ADMIN_PAGE_SIZE = 20;
export const REASON_MAX = 200;

export type AdminResult = { ok: true; message: string } | { ok: false; error: string };

export const ADMIN_ERRORS = {
  notFound: "회원을 찾지 못했어요",
  self: "내 계정에는 할 수 없어요",
  adminTarget: "관리자에게는 할 수 없어요. 먼저 관리자 권한을 빼 주세요",
  lastAdmin: "관리자가 한 명은 있어야 해요",
  reason: `사유를 1~${REASON_MAX}자로 적어 주세요`,
  days: "정지 기간을 골라 주세요",
  postNotFound: "글을 찾지 못했어요",
  noneSelected: "지울 항목을 골라 주세요",
  invalid: "요청이 올바르지 않아요",
  grant: "코인·경험치를 0 이상 숫자로 적어 주세요 (둘 중 하나는 1 이상)",
} as const;

// ── 회원 정지 (ADM-01) ─────────────────────────────────────

/** 정지 기간: 일 수, 0은 영구 */
export const SUSPEND_DAYS = [1, 7, 30, 0] as const;
export type SuspendDays = (typeof SUSPEND_DAYS)[number];

/** 영구 정지는 이 시각까지로 저장한다 (DB의 'infinity'는 자바스크립트 날짜로 읽히지 않는다) */
export const PERMANENT_UNTIL = new Date("9999-12-31T00:00:00Z");

export function suspendLabel(days: SuspendDays): string {
  return days === 0 ? "영구" : `${days}일`;
}

/** 폼의 정지 기간 값 → 일 수. 고를 수 있는 값이 아니면 null */
export function parseSuspendDays(value: unknown): SuspendDays | null {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,2})$/.test(value)) return null;
  const n = Number(value);
  return (SUSPEND_DAYS as readonly number[]).includes(n) ? (n as SuspendDays) : null;
}

/** 정지가 끝나는 시각. 영구면 PERMANENT_UNTIL */
export function suspendUntil(days: SuspendDays, now = new Date()): Date {
  return days === 0 ? PERMANENT_UNTIL : new Date(now.getTime() + days * 86_400_000);
}

/** 사유: 앞뒤 공백을 지우고 공백을 하나로, 1~200자. 아니면 null */
export function parseReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim().replace(/\s+/g, " ");
  return reason.length >= 1 && reason.length <= REASON_MAX ? reason : null;
}

/** 지금 정지 중인지 */
export function isSuspended(until: Date | null, now = new Date()): boolean {
  return until !== null && until.getTime() > now.getTime();
}

export function isPermanent(until: Date): boolean {
  return until.getTime() >= PERMANENT_UNTIL.getTime();
}

/** 한국 시간 `2026.10.20 15:00` */
export const formatKST = formatDateTime;

/** 로그인 화면·관리자 화면의 정지 문구: `이용이 정지된 계정이에요 (2026. 10. 20. 15:00까지, 사유: 도배)` */
export function suspendedMessage(until: Date, reason: string | null): string {
  const when = isPermanent(until) ? "영구 정지" : `${formatKST(until)}까지`;
  return `이용이 정지된 계정이에요 (${when}${reason ? `, 사유: ${reason}` : ""})`;
}

// ── 역할·강제 탈퇴 (ADM-01) ────────────────────────────────

/**
 * 관리자 지정·해제를 막는 이유. 막을 이유가 없으면 null.
 * 내 역할은 바꿀 수 없고, 마지막 관리자는 해제할 수 없다.
 */
export function roleChangeError(input: {
  actorId: string;
  targetId: string;
  targetRole: string;
  newRole: "admin" | "user";
  adminCount: number;
}): string | null {
  if (input.actorId === input.targetId) return ADMIN_ERRORS.self;
  if (input.newRole === "user" && input.targetRole === "admin" && input.adminCount <= 1) return ADMIN_ERRORS.lastAdmin;
  return null;
}

/** 강제 탈퇴·정지를 막는 이유: 나 자신, 다른 관리자. 막을 이유가 없으면 null */
export function memberActionError(input: { actorId: string; targetId: string; targetRole: string }): string | null {
  if (input.actorId === input.targetId) return ADMIN_ERRORS.self;
  if (input.targetRole === "admin") return ADMIN_ERRORS.adminTarget;
  return null;
}

// ── 찾기·페이지 ────────────────────────────────────────────

/** 검색어: 앞뒤 공백을 지우고 50자까지. 없으면 빈 문자열 */
export function parseQuery(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 50) : "";
}

/** LIKE 검색에 넣을 값 (%, _, \ 는 글자 그대로) */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// ── 콘텐츠 관리 (ADM-02) ───────────────────────────────────

export const CONTENT_TABS = ["posts", "comments", "guestbook"] as const;
export type ContentTab = (typeof CONTENT_TABS)[number];
export const CONTENT_TAB_LABELS: Record<ContentTab, string> = { posts: "글", comments: "댓글·답글", guestbook: "방명록" };

export function parseContentTab(value: unknown): ContentTab {
  return (CONTENT_TABS as readonly unknown[]).includes(value) ? (value as ContentTab) : "posts";
}

/** 한 번에 지울 수 있는 수 (한 쪽 20개보다 넉넉히) */
export const BULK_MAX = 50;

export type ContentRef = { kind: "post" | "comment" | "reply" | "guestbook"; id: number };

/**
 * 선택 삭제 폼의 `items` 값들(`comment:12`)을 읽는다. 탭에 맞지 않는 종류·이상한 ID가 하나라도 있거나 0개·50개 초과면 null.
 * 같은 항목은 한 번만.
 */
export function parseContentRefs(tab: ContentTab, values: unknown[]): ContentRef[] | null {
  const allowed: ContentRef["kind"][] = tab === "posts" ? ["post"] : tab === "comments" ? ["comment", "reply"] : ["guestbook"];
  if (values.length === 0 || values.length > BULK_MAX) return null;
  const seen = new Set<string>();
  const out: ContentRef[] = [];
  for (const v of values) {
    if (typeof v !== "string") return null;
    const m = /^(post|comment|reply|guestbook):([1-9][0-9]{0,9})$/.exec(v);
    if (!m || !allowed.includes(m[1] as ContentRef["kind"])) return null;
    const id = Number(m[2]);
    if (id > 2147483647) return null;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push({ kind: m[1] as ContentRef["kind"], id });
  }
  return out;
}

/** 목록·기록에 보일 한 줄 요약 (공백을 하나로, 60자 넘으면 …) */
export function snippet(text: string, max = 60): string {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max)}…` : one;
}

// ── 사이트 공지 띠 (ADM-04) ────────────────────────────────

export const NOTICE_MAX = 200;
export const NOTICE_LINK_MAX = 200;

export type SiteNotice = { text: string; link: string | null; enabled: boolean };

export const NOTICE_ERRORS = {
  text: `공지 문구를 1~${NOTICE_MAX}자로 적어 주세요`,
  link: "링크는 이 사이트 안의 주소(/로 시작)만 쓸 수 있어요",
} as const;

/**
 * 공지 띠 폼 값 확인. 문구는 공백을 하나로 줄여 1~200자 (끄더라도 저장해 두므로 같은 규칙).
 * 링크는 비워도 되고, 쓰면 이 사이트 안의 `/…` 주소만 (safeNext).
 */
export function parseNotice(input: { text: unknown; link: unknown; enabled: unknown }): { ok: true; value: SiteNotice } | { ok: false; error: string } {
  const text = typeof input.text === "string" ? input.text.trim().replace(/\s+/g, " ") : "";
  if (text.length < 1 || text.length > NOTICE_MAX) return { ok: false, error: NOTICE_ERRORS.text };
  const rawLink = typeof input.link === "string" ? input.link.trim() : "";
  let link: string | null = null;
  if (rawLink) {
    link = rawLink.length <= NOTICE_LINK_MAX ? safeNext(rawLink) : null;
    if (!link) return { ok: false, error: NOTICE_ERRORS.link };
  }
  return { ok: true, value: { text, link, enabled: input.enabled === "on" || input.enabled === "true" } };
}

const noticeSchema = z.object({ text: z.string().min(1).max(NOTICE_MAX), link: z.string().max(NOTICE_LINK_MAX).nullable(), enabled: z.boolean() });

/** DB에 저장한 공지 띠(JSON)를 읽는다. 망가졌으면 null */
export function decodeNotice(value: string | null | undefined): SiteNotice | null {
  if (!value) return null;
  try {
    const parsed = noticeSchema.safeParse(JSON.parse(value));
    if (!parsed.success) return null;
    return { ...parsed.data, link: parsed.data.link ? safeNext(parsed.data.link) : null };
  } catch {
    return null;
  }
}

/** 닫은 공지 띠를 기억하는 브라우저 저장소 키. 공지를 바꾸면(시각이 바뀌면) 다시 보인다 */
export function noticeDismissKey(updatedAt: Date): string {
  return `bv-notice-dismissed:${updatedAt.getTime()}`;
}

// ── 금지어 (ADM-05) ────────────────────────────────────────

export const BANNED_MAX_WORDS = 200;
export const BANNED_WORD_MAX = 30;

export const BANNED_ERRORS = {
  tooMany: `금지어는 ${BANNED_MAX_WORDS}개까지 등록할 수 있어요`,
  tooLong: (word: string) => `금지어는 한 줄에 1~${BANNED_WORD_MAX}자로 적어 주세요: ${word.slice(0, BANNED_WORD_MAX)}…`,
} as const;

/** 비교용: 소문자로 (대소문자 무시) */
const fold = (s: string) => s.normalize("NFC").toLowerCase();

/**
 * 금지어 입력(한 줄에 하나) 확인: 줄마다 앞뒤 공백을 지우고, 빈 줄과 대소문자만 다른 중복은 뺀다.
 * 줄이 30자를 넘거나 200개를 넘으면 오류.
 */
export function parseBannedWords(input: unknown): { ok: true; words: string[] } | { ok: false; error: string } {
  if (typeof input !== "string") return { ok: true, words: [] };
  const words: string[] = [];
  const seen = new Set<string>();
  for (const line of input.split(/\r?\n/)) {
    const word = line.trim().normalize("NFC");
    if (!word) continue;
    if (word.length > BANNED_WORD_MAX) return { ok: false, error: BANNED_ERRORS.tooLong(word) };
    const key = fold(word);
    if (seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  if (words.length > BANNED_MAX_WORDS) return { ok: false, error: BANNED_ERRORS.tooMany };
  return { ok: true, words };
}

/** 글자 안에 든 첫 금지어 (대소문자 무시, 부분 일치). 없으면 null */
export function findBannedWord(text: string, words: readonly string[]): string | null {
  if (words.length === 0 || !text) return null;
  const hay = fold(text);
  for (const word of words) if (hay.includes(fold(word))) return word;
  return null;
}

export function bannedWordMessage(word: string): string {
  return `사용할 수 없는 말이 들어 있어요: ${word}`;
}

/** 여러 칸(제목·본문 등) 중 하나라도 금지어가 있으면 오류 문구, 없으면 null */
export function bannedWordError(words: readonly string[], ...texts: string[]): string | null {
  for (const text of texts) {
    const hit = findBannedWord(text, words);
    if (hit) return bannedWordMessage(hit);
  }
  return null;
}

// ── 통계 (ADM-03) ──────────────────────────────────────────

export const STAT_RANGES = [7, 30] as const;
export type StatRange = (typeof STAT_RANGES)[number];

export function parseStatRange(value: unknown): StatRange {
  return value === "30" ? 30 : 7;
}

/** 최근 N일(한국 날짜) 'YYYY-MM-DD' 목록, 오래된 날부터 */
export function lastDaysKST(days: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() + 9 * 3600_000 - i * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// ── 관리 기록 (ADM-06) ─────────────────────────────────────

export const AUDIT_ACTIONS = {
  suspend: "회원 정지",
  unsuspend: "정지 해제",
  grant_admin: "관리자 지정",
  revoke_admin: "관리자 해제",
  delete_member: "강제 탈퇴",
  reset_password: "비밀번호 초기화",
  delete_post: "글 삭제",
  delete_comment: "댓글 삭제",
  delete_reply: "답글 삭제",
  delete_guestbook: "방명록 삭제",
  blind_post: "글 블라인드",
  unblind_post: "블라인드 해제",
  notice: "공지 띠 변경",
  banned_words: "금지어 변경",
  feedback: "문의 답변",
  dismiss_reports: "신고 기각",
  resolve_error: "오류 해결",
  grant_points: "코인·경험치 지급",
} as const;
export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function parseAuditAction(value: unknown): AuditAction | null {
  return typeof value === "string" && Object.hasOwn(AUDIT_ACTIONS, value) ? (value as AuditAction) : null;
}

// ── 코인·경험치 지급 (ADM-01) ──────────────────────────────

/** 한 번에 줄 수 있는 최대 코인·경험치. 경험치 100,000이면 Lv.99를 넘는다 */
export const GRANT_COIN_MAX = 1_000_000;
export const GRANT_EXP_MAX = 100_000;

/** 지급 칸 값 → 0 이상 정수. 비우면 0, 쉼표는 지운다. 범위를 넘거나 숫자가 아니면 null */
export function parseGrantAmount(value: unknown, max: number): number | null {
  if (value == null) return 0;
  if (typeof value !== "string") return null;
  const text = value.replaceAll(",", "").trim();
  if (text === "") return 0;
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n <= max ? n : null;
}
