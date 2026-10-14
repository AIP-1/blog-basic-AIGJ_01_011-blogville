// 📅 캘린더 위젯 (v1.7.0 위젯 보드): 이번 달 달력, 글 쓴 날 점, 공휴일 빨강, 날짜를 누르면 그날 글.

/**
 * 한국 공휴일 (대체공휴일 포함). 해가 바뀌면 다음 해를 더한다.
 * 2026년부터 노동절(5/1)·제헌절(7/17)이 공휴일이 됐다. 임시공휴일은 정해지면 더한다.
 */
export const HOLIDAYS: Readonly<Record<string, string>> = {
  "2026-01-01": "신정",
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-01": "노동절",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-03": "지방선거",
  "2026-06-06": "현충일",
  "2026-07-17": "제헌절",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  "2026-09-28": "대체공휴일",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
  "2027-01-01": "신정",
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  "2027-02-09": "대체공휴일",
  "2027-03-01": "삼일절",
  "2027-05-01": "노동절",
  "2027-05-05": "어린이날",
  "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일",
  "2027-07-17": "제헌절",
  "2027-08-15": "광복절",
  "2027-08-16": "대체공휴일",
  "2027-09-14": "추석 연휴",
  "2027-09-15": "추석",
  "2027-09-16": "추석 연휴",
  "2027-10-03": "개천절",
  "2027-10-04": "대체공휴일",
  "2027-10-09": "한글날",
  "2027-10-11": "대체공휴일",
  "2027-12-25": "성탄절",
  "2027-12-27": "대체공휴일",
};

export type CalendarPost = { id: number; title: string };
/** 날짜(`YYYY-MM-DD`, 한국 시간)별 그날 쓴 글 */
export type CalendarMonth = { month: string; days: Record<string, CalendarPost[]> };

/** `2026-10` 모양만. 2000~2099년 */
export function parseMonth(value: unknown): string | null {
  return typeof value === "string" && /^20\d\d-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

/** 한 달 앞뒤 (`2026-10` → `2026-09` / `2026-11`) */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * 달력 칸: 일요일 시작 6줄(42칸)이 아니라 필요한 줄만. 앞뒤는 이웃 달 날짜로 채운다 (그림처럼 흐리게).
 * 각 칸은 날짜와 이 달인지.
 */
export function monthGrid(month: string): { date: string; inMonth: boolean }[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const total = Math.ceil((lead + days) / 7) * 7;
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < total; i++) {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i));
    cells.push({ date: d.toISOString().slice(0, 10), inMonth: i >= lead && i < lead + days });
  }
  return cells;
}

/** 일요일·공휴일은 빨강, 토요일은 파랑 */
export function dayTone(date: string): "holiday" | "saturday" | null {
  const [y, m, d] = date.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (wd === 0 || HOLIDAYS[date]) return "holiday";
  return wd === 6 ? "saturday" : null;
}
