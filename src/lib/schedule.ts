// 예약 발행 (개선 11): 글쓰기 화면의 날짜·시간 칸은 한국 시간으로 읽고 쓴다.

/** 지금부터 이만큼 뒤부터 고를 수 있다 */
export const SCHEDULE_MIN_MS = 5 * 60_000;
/** 이만큼 앞까지 고를 수 있다 */
export const SCHEDULE_MAX_DAYS = 90;

export const SCHEDULE_ERRORS = {
  invalid: "예약 시간을 골라 주세요",
  tooSoon: "예약은 지금부터 5분 뒤부터 할 수 있어요",
  tooLate: `예약은 ${SCHEDULE_MAX_DAYS}일 안으로만 할 수 있어요`,
} as const;

const KST_OFFSET_MS = 9 * 3_600_000;
const LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** `2026-10-14T09:00`(한국 시간, <input type="datetime-local"> 값) → 그 순간. 모양이 틀리거나 없는 날짜면 null */
export function parseKstLocal(value: string): Date | null {
  const m = LOCAL_PATTERN.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  return new Date(utc - KST_OFFSET_MS);
}

/** 그 순간 → `2026-10-14T09:00` (한국 시간) */
export function formatKstLocal(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16);
}

/** 새로 예약할 때 처음 보여 줄 시간: 다음 정각(5분 안이면 그다음 정각) */
export function defaultScheduleValue(now = new Date()): string {
  const next = new Date(now.getTime() + SCHEDULE_MIN_MS);
  next.setUTCMinutes(0, 0, 0);
  next.setUTCHours(next.getUTCHours() + 1);
  return formatKstLocal(next);
}

/** 고른 시간이 고를 수 있는 범위인지. 괜찮으면 null, 아니면 문구 */
export function scheduleError(at: Date | null, now = new Date()): string | null {
  if (!at) return SCHEDULE_ERRORS.invalid;
  if (at.getTime() < now.getTime() + SCHEDULE_MIN_MS - 60_000) return SCHEDULE_ERRORS.tooSoon;
  if (at.getTime() > now.getTime() + SCHEDULE_MAX_DAYS * 86_400_000) return SCHEDULE_ERRORS.tooLate;
  return null;
}

const labelFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** `10월 14일 (화) 오전 9:00` */
export function scheduleLabel(date: Date): string {
  return labelFormat.format(date);
}
