// 📅 캘린더 위젯: 달력 칸 계산과 우리나라 공휴일. 브라우저와 서버가 같이 쓴다. 날짜는 모두 한국 날짜.

/** 한 날짜에 쓴 글 (위젯은 제목만) */
export type CalendarPost = { id: number; title: string };
/** `YYYY-MM` 한 달: 날(1~31) → 그날 쓴 공개 글 */
export type CalendarMonth = { month: string; days: Record<number, CalendarPost[]> };

export const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** `2026-10` → { year: 2026, month: 10 }. 이상하면 null. 2000~2100년만 */
export function parseMonth(value: string | null | undefined): { year: number; month: number } | null {
  const m = MONTH_RE.exec(value ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  if (year < 2000 || year > 2100) return null;
  return { year, month: Number(m[2]) };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** 이전·다음 달 */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 그 날의 요일 (0 = 일요일) */
export function weekday(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** 달력 칸: 일요일부터 한 주씩, 앞뒤 빈칸은 null */
export function monthGrid(year: number, month: number): (number | null)[][] {
  const first = weekday(year, month, 1);
  const total = daysInMonth(year, month);
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** 오늘(한국 날짜)이 든 주: 일요일부터 7일, 날마다 { year, month, day } (달이 바뀌어도 이어서) */
export function weekOf(year: number, month: number, day: number): { year: number; month: number; day: number }[] {
  const start = Date.UTC(year, month - 1, day) - weekday(year, month, day) * 86_400_000;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start + i * 86_400_000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  });
}

/** 한국 시간의 오늘 */
export function todayParts(now: Date = new Date()): { year: number; month: number; day: number } {
  const d = new Date(now.getTime() + 9 * 3_600_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// 관공서 공휴일 (대체 공휴일 포함). 음력 명절은 해마다 달라서 표로 둔다. 표에 없는 해는 양력 공휴일만.
const FIXED: Record<string, string> = {
  "01-01": "새해",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "성탄절",
};
const BY_YEAR: Record<number, Record<string, string>> = {
  2025: {
    "01-27": "임시 공휴일",
    "01-28": "설날 연휴",
    "01-29": "설날",
    "01-30": "설날 연휴",
    "03-03": "대체 공휴일",
    "05-05": "어린이날·부처님오신날",
    "05-06": "대체 공휴일",
    "06-03": "대통령 선거",
    "10-05": "추석 연휴",
    "10-06": "추석",
    "10-07": "추석 연휴",
    "10-08": "대체 공휴일",
  },
  2026: {
    "02-16": "설날 연휴",
    "02-17": "설날",
    "02-18": "설날 연휴",
    "03-02": "대체 공휴일",
    "05-24": "부처님오신날",
    "05-25": "대체 공휴일",
    "06-03": "지방 선거",
    "08-17": "대체 공휴일",
    "09-24": "추석 연휴",
    "09-25": "추석",
    "09-26": "추석 연휴",
    "10-05": "대체 공휴일",
  },
  2027: {
    "02-06": "설날 연휴",
    "02-07": "설날",
    "02-08": "설날 연휴",
    "02-09": "대체 공휴일",
    "05-13": "부처님오신날",
    "08-16": "대체 공휴일",
    "09-14": "추석 연휴",
    "09-15": "추석",
    "09-16": "추석 연휴",
    "10-04": "대체 공휴일",
    "10-11": "대체 공휴일",
    "12-27": "대체 공휴일",
  },
};

/** 그 날이 공휴일이면 이름, 아니면 null */
export function holidayName(year: number, month: number, day: number): string | null {
  const key = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return BY_YEAR[year]?.[key] ?? FIXED[key] ?? null;
}
