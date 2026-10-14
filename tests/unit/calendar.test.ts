import { describe, expect, it } from "vitest";
import { holidayName, monthGrid, parseMonth, shiftMonth, todayParts, weekOf } from "@/lib/calendar";

describe("캘린더 계산", () => {
  it("2026년 10월은 목요일에 시작하고 31일, 5주", () => {
    const g = monthGrid(2026, 10);
    expect(g[0]).toEqual([null, null, null, null, 1, 2, 3]);
    expect(g).toHaveLength(5);
    expect(g.at(-1)).toEqual([25, 26, 27, 28, 29, 30, 31]);
  });
  it("이전·다음 달, 해 넘김", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
  it("이번 주는 일요일부터, 달이 바뀌어도 이어서", () => {
    expect(weekOf(2026, 10, 1).map((d) => `${d.month}/${d.day}`)).toEqual(["9/27", "9/28", "9/29", "9/30", "10/1", "10/2", "10/3"]);
  });
  it("한국 날짜의 오늘", () => {
    expect(todayParts(new Date("2026-10-13T15:30:00Z"))).toEqual({ year: 2026, month: 10, day: 14 });
  });
  it("월 주소는 YYYY-MM만", () => {
    expect(parseMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    for (const v of ["2026-13", "2026-1", "1999-01", "x", null]) expect(parseMonth(v)).toBeNull();
  });
  it("공휴일: 양력·음력 명절·대체 공휴일", () => {
    expect(holidayName(2026, 10, 9)).toBe("한글날");
    expect(holidayName(2026, 9, 25)).toBe("추석");
    expect(holidayName(2026, 10, 5)).toBe("대체 공휴일");
    expect(holidayName(2026, 10, 14)).toBeNull();
    expect(holidayName(2030, 3, 1)).toBe("삼일절");
  });
});
