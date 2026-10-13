// 관리자 회원·글·사이트 관리 규칙. 서버와 시험이 같이 쓰는 순수 함수만 둔다.

/** 정지 기간 고르기: 일 수, 0은 영구 정지 */
export const SUSPEND_DAYS = [1, 3, 7, 30, 0] as const;
export type SuspendDays = (typeof SUSPEND_DAYS)[number];

export const REASON_MAX = 200;
export const BANNER_MAX = 200;
export const ADMIN_PAGE_SIZE = 20;

export const ADMIN_ERRORS = {
  notFound: "회원을 찾지 못했어요",
  self: "내 계정에는 할 수 없어요",
  adminTarget: "관리자는 정지할 수 없어요. 먼저 관리자 권한을 빼 주세요",
  lastAdmin: "관리자가 한 명은 있어야 해요",
  reason: `사유를 1~${REASON_MAX}자로 적어 주세요`,
  days: "정지 기간을 골라 주세요",
  postNotFound: "글을 찾지 못했어요",
  banner: `공지 띠 문구는 ${BANNER_MAX}자까지 쓸 수 있어요`,
} as const;

export type AdminResult = { ok: true; message: string } | { ok: false; error: string };

export function suspendLabel(days: SuspendDays): string {
  return days === 0 ? "영구" : `${days}일`;
}

/** 폼의 정지 기간 값 → 일 수. 고를 수 있는 값이 아니면 null */
export function parseSuspendDays(value: unknown): SuspendDays | null {
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return (SUSPEND_DAYS as readonly number[]).includes(n) ? (n as SuspendDays) : null;
}

/** 사유: 앞뒤 공백을 지우고 1~200자. 아니면 null */
export function parseReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim().replace(/\s+/g, " ");
  return reason.length >= 1 && reason.length <= REASON_MAX ? reason : null;
}

/** 공지 띠: 빈 문자열이면 끔. 200자를 넘거나 문자열이 아니면 null */
export function parseBanner(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length <= BANNER_MAX ? text : null;
}

/** 지금 정지 중인지 (영구 정지는 Infinity 날짜) */
export function isSuspended(until: Date | null, now = new Date()): boolean {
  return until !== null && until.getTime() > now.getTime();
}

/** 로그인 화면·관리자 화면에 보이는 정지 문구 */
export function suspendedMessage(until: Date, reason: string | null): string {
  const when = Number.isFinite(until.getTime())
    ? `${until.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}까지`
    : "영구";
  return `이용이 정지된 계정이에요 (${when}${reason ? `, 사유: ${reason}` : ""}). 문의는 공지 블로그로 해 주세요.`;
}

/** 검색어: 앞뒤 공백을 지우고 50자까지. 없으면 빈 문자열 */
export function parseQuery(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 50) : "";
}

/** LIKE 검색에 넣을 값 (%, _, \ 는 글자 그대로) */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** 관리 기록 종류 → 화면 문구 */
export const LOG_LABELS: Record<string, string> = {
  suspend: "회원 정지",
  unsuspend: "정지 해제",
  grant_admin: "관리자 권한 주기",
  revoke_admin: "관리자 권한 빼기",
  reset_password: "비밀번호 초기화",
  blind_post: "글 블라인드",
  unblind_post: "블라인드 해제",
  delete_post: "글 삭제",
  delete_comment: "댓글 삭제",
  banner: "공지 띠 바꾸기",
};

/** 최근 7일(한국 날짜) 'YYYY-MM-DD' 목록, 오래된 날부터 */
export function lastDaysKST(days: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() + 9 * 3600_000 - i * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
