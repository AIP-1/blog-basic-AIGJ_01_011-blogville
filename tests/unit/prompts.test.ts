import { describe, expect, it } from "vitest";
import { HOLIDAYS } from "@/lib/calendar";
import { parseTags } from "@/lib/post-rules";
import { currentPrompt, HOLIDAY_PROMPTS, parseWeekKey, promptForWeek, promptTags, weekKey, weekLabel, weekRange, WEEKLY_PROMPTS } from "@/lib/town/prompts";

const kst = (s: string) => new Date(`${s}+09:00`);

describe("이번 주 글감 (plaza-upgrade-2 C1)", () => {
  it("한국 시각 ISO 주 키: 2026-10-17(토)은 2026-W42, 월요일 0시 KST에 바뀐다", () => {
    expect(currentPrompt(kst("2026-10-17T12:00:00")).key).toBe("2026-W42");
    expect(weekKey(kst("2026-10-12T00:00:00"))).toBe("2026-W42");
    expect(weekKey(kst("2026-10-11T23:59:59"))).toBe("2026-W41");
    // UTC로는 일요일 15시지만 한국은 월요일 0시
    expect(weekKey(new Date("2026-10-18T15:00:00Z"))).toBe("2026-W43");
    // 해 경계: 2027-01-01(금)은 2026-W53, 2025-12-29(월)는 2026-W01
    expect(weekKey(kst("2027-01-01T09:00:00"))).toBe("2026-W53");
    expect(weekKey(kst("2025-12-29T09:00:00"))).toBe("2026-W01");
  });

  it("52주 글감에 빈 칸이 없고, 태그는 한 단어(태그 규칙 그대로 살아남는다)", () => {
    expect(WEEKLY_PROMPTS).toHaveLength(52);
    const all = [...WEEKLY_PROMPTS, ...Object.values(HOLIDAY_PROMPTS)];
    for (const p of all) {
      expect(p.title.trim().length, p.tag).toBeGreaterThan(0);
      expect(p.hint.trim().length, p.tag).toBeGreaterThan(0);
      expect(parseTags(p.tag)).toEqual([p.tag]);
      expect(p.hint).not.toContain("—");
    }
    expect(new Set(WEEKLY_PROMPTS.map((p) => p.tag)).size).toBe(52);
    for (let w = 1; w <= 53; w++) {
      const key = `2026-W${String(w).padStart(2, "0")}`;
      expect(promptForWeek(key).title, key).toBeTruthy();
    }
  });

  it("2026-10-09(한글날)가 든 주는 특별 글감 '내가 좋아하는 우리말'", () => {
    expect(HOLIDAYS["2026-10-09"]).toBe("한글날");
    const p = currentPrompt(kst("2026-10-09T10:00:00"));
    expect(p.key).toBe("2026-W41");
    expect(p.title).toBe("내가 좋아하는 우리말");
    expect(p.tag).toBe("우리말");
    // 연휴·대체공휴일 이름은 특별 글감이 아니다: 추석(9/25)이 든 주만 추석 글감
    expect(currentPrompt(kst("2026-09-25T10:00:00")).tag).toBe("추석");
    expect(currentPrompt(kst("2026-12-25T10:00:00")).tag).toBe("선물");
  });

  it("주 키 읽기·기간", () => {
    expect(parseWeekKey("2026-W42")).toBe("2026-W42");
    expect(parseWeekKey("2026-W53")).toBe("2026-W53");
    expect(parseWeekKey("2027-W53")).toBeNull();
    expect(parseWeekKey("2026-W00")).toBeNull();
    expect(parseWeekKey("2026-42")).toBeNull();
    expect(parseWeekKey(["2026-W42"])).toBeNull();
    const { start, end } = weekRange("2026-W42");
    expect(start.toISOString()).toBe("2026-10-11T15:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-18T15:00:00.000Z");
    expect(weekLabel("2026-W42")).toBe("10월 12일 ~ 10월 18일");
    expect(promptTags(currentPrompt(kst("2026-10-17T12:00:00")))).toBe("글감, 가을길");
  });
});
