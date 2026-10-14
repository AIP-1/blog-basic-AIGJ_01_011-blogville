// 블로그 곳곳의 시각 표시 (모두 한국 시간, 분까지).
//   formatDateTime  `2026.10.14 14:05`                       관리자 화면·지갑·문의처럼 정확한 시각이 필요한 곳
//   relativeTime    `방금 전` / `12분 전` / `3시간 전` / `어제 14:05` / `2026.10.12 14:05`   글·댓글·알림 등
//   fullDateTime    `2026년 10월 14일 오후 2:05 (한국 시간)`  마우스를 올렸을 때(title)
// 화면에는 components/common/Time.tsx 를 쓴다 (<time datetime>에 원래 시각, 1분마다 상대 시각을 새로 고침).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function kstParts(date: Date) {
  const p = Object.fromEntries(partsFormat.formatToParts(date).map((x) => [x.type, x.value]));
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** 한국 날짜의 일련번호 (어제·오늘 비교용) */
function kstDayNumber(date: Date): number {
  return Math.floor((date.getTime() + 9 * HOUR) / DAY);
}

/** `14:05` (한국 시간, 24시간) */
export function formatTime(date: Date): string {
  const p = kstParts(date);
  return `${p.hour}:${p.minute}`;
}

/** `2026.10.14` (한국 시간) */
export function formatDate(date: Date): string {
  const p = kstParts(date);
  return `${p.year}.${p.month}.${p.day}`;
}

/** `2026.10.14 14:05` (한국 시간, 24시간) */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** `2026년 10월 14일 오후 2:05 (한국 시간)` — seconds면 `오후 2:05:09` */
export function fullDateTime(date: Date, { seconds = false } = {}): string {
  const p = kstParts(date);
  const h = Number(p.hour);
  const ampm = h < 12 ? "오전" : "오후";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${p.year}년 ${Number(p.month)}월 ${Number(p.day)}일 ${ampm} ${h12}:${p.minute}${seconds ? `:${p.second}` : ""} (한국 시간)`;
}

/** `방금 전` / `N분 전` / 오늘이면 `N시간 전` / `어제 14:05` / 그 전은 `2026.10.12 14:05` (한국 시간). 시계가 어긋나 미래면 `방금 전`. */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "방금 전";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}분 전`;
  const days = kstDayNumber(now) - kstDayNumber(date);
  if (days === 0) return `${Math.floor(diff / HOUR)}시간 전`;
  if (days === 1) return `어제 ${formatTime(date)}`;
  return formatDateTime(date);
}

/** 상대 시각이 다음에 바뀔 때까지 남은 시간 (ms). 하루가 지나 날짜로 굳으면 null */
export function nextRelativeChange(date: Date, now: Date = new Date()): number | null {
  const diff = now.getTime() - date.getTime();
  if (kstDayNumber(now) - kstDayNumber(date) >= 2) return null;
  if (diff < 0) return MINUTE;
  const step = diff < HOUR ? MINUTE : HOUR;
  const untilStep = step - (diff % step);
  // 자정이 먼저 오면 그때 (`3시간 전` → `어제 21:00`)
  const untilMidnight = DAY - ((now.getTime() + 9 * HOUR) % DAY);
  return Math.min(untilStep, untilMidnight);
}
