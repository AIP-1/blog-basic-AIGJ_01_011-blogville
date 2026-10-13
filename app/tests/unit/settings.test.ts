import { describe, expect, it } from "vitest";
import { AUTH_ERRORS as E, checkPasswordChange } from "@/lib/auth-rules";
import { fillDays, lastDays } from "@/lib/kst";

describe("최근 7일 (BLOG-06)", () => {
  it("오늘까지 7일, 오래된 날부터, 달·해가 바뀌어도", () => {
    expect(lastDays("2026-10-03", 7)).toEqual(["2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(lastDays("2027-01-01", 2)).toEqual(["2026-12-31", "2027-01-01"]);
  });
  it("기록 없는 날은 0, 범위 밖 기록은 버린다", () => {
    const days = lastDays("2026-10-12", 3);
    expect(fillDays(days, [{ date: "2026-10-12", count: 2 }, { date: "2026-10-01", count: 9 }, { date: "2026-10-10", count: 1 }])).toEqual([
      { date: "2026-10-10", count: 1 },
      { date: "2026-10-11", count: 0 },
      { date: "2026-10-12", count: 2 },
    ]);
  });
});

describe("비밀번호 바꾸기", () => {
  const ok = { current: "password1", next: "newpass12", confirm: "newpass12" };
  it("빈칸·길이·확인·같은 값 순서로 하나만", () => {
    expect(checkPasswordChange(ok)).toBeNull();
    expect(checkPasswordChange({ ...ok, current: "" })).toBe(E.changeEmpty);
    expect(checkPasswordChange({ ...ok, next: "", confirm: "" })).toBe(E.changeEmpty);
    expect(checkPasswordChange({ ...ok, next: "short12", confirm: "short12" })).toBe(E.passwordTooShort);
    expect(checkPasswordChange({ ...ok, next: "a".repeat(65), confirm: "a".repeat(65) })).toBe(E.passwordTooLong);
    expect(checkPasswordChange({ ...ok, confirm: "newpass13" })).toBe(E.passwordMismatch);
    expect(checkPasswordChange({ current: "password1", next: "password1", confirm: "password1" })).toBe(E.changeSame);
  });
});
