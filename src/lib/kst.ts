// 한국 날짜 (조회수·방문자 "하루 1번", POST-06·BLOG-06)

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

/** `2026-10-11` (한국 시간 0시 기준) */
export function todayKST(now = new Date()): string {
  return dayFormat.format(now);
}

/** 하루 전 날짜 (`YYYY-MM-DD`) */
export function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
