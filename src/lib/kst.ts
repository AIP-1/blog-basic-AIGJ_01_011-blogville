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

/** 오늘까지 n일 (`YYYY-MM-DD`, 오래된 날부터) */
export function lastDays(today: string, n: number): string[] {
  const days = [today];
  while (days.length < n) days.unshift(previousDay(days[0]));
  return days;
}

/** 날짜별 수를 n일 칸에 채운다. 기록이 없는 날은 0 (BLOG-06 최근 7일 그래프) */
export function fillDays(days: string[], rows: { date: string; count: number }[]): { date: string; count: number }[] {
  const byDate = new Map(rows.map((r) => [r.date, r.count]));
  return days.map((date) => ({ date, count: byDate.get(date) ?? 0 }));
}
