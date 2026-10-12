import { describe, expect, it } from "vitest";
import { expForLevel, levelFromExp, levelProgress, levelsGained, MAX_LEVEL, postEarnsReward, REWARD_RULES } from "@/lib/game";

describe("레벨 (GAME-02)", () => {
  it("Lv.2·3·4·10·99의 필요 누적 경험치", () => {
    expect([2, 3, 4, 10, 99].map(expForLevel)).toEqual([20, 60, 120, 900, 97_020]);
  });
  it("19면 Lv.1, 20이면 Lv.2, 최고는 99", () => {
    expect(levelFromExp(0)).toBe(1);
    expect(levelFromExp(19)).toBe(1);
    expect(levelFromExp(20)).toBe(2);
    expect(levelFromExp(97_019)).toBe(98);
    expect(levelFromExp(97_020)).toBe(MAX_LEVEL);
    expect(levelFromExp(10_000_000)).toBe(MAX_LEVEL);
  });
  it("경험치 250이면 Lv.5, 50 / 100", () => {
    expect(levelProgress(250)).toEqual({ level: 5, current: 50, needed: 100, ratio: 0.5, isMax: false });
    expect(levelProgress(97_020).isMax).toBe(true);
  });
  it("오른 레벨들", () => {
    expect(levelsGained(195, 200)).toEqual([5]);
    expect(levelsGained(0, 120)).toEqual([2, 3, 4]);
    expect(levelsGained(30, 40)).toEqual([]);
  });
  it("명세의 예 (GAME-06): 19→20 [2], 18→70 [2, 3], 97,010→97,020 [99], 최고 레벨 뒤 []", () => {
    expect(levelsGained(19, 20)).toEqual([2]);
    expect(levelsGained(18, 70)).toEqual([2, 3]);
    expect(levelsGained(97_010, 97_020)).toEqual([99]);
    expect(levelsGained(97_020, 99_999)).toEqual([]);
  });
});

describe("보상 규칙 (GAME-05)", () => {
  it("표의 숫자", () => {
    expect(REWARD_RULES).toEqual({
      signup: { exp: 0, coin: 100, dailyLimit: 1 },
      post: { exp: 30, coin: 30, dailyLimit: 3 },
      comment: { exp: 5, coin: 5, dailyLimit: 10 },
      like_received: { exp: 2, coin: 2, dailyLimit: 20 },
    });
  });
  it("글쓰기 보상은 공개 새 글, 100자 이상", () => {
    expect(postEarnsReward(true, true, 100)).toBe(true);
    expect(postEarnsReward(true, true, 99)).toBe(false);
    expect(postEarnsReward(true, false, 500)).toBe(false);
    expect(postEarnsReward(false, true, 500)).toBe(false);
  });
});

describe("출석 일차 (GAME-04)", () => {
  it("처음·어제 이어서·7일차 다음·하루 빠짐", async () => {
    const { nextCycleDay } = await import("@/lib/game");
    expect(nextCycleDay(null, "2026-10-01", "2026-09-30")).toBe(1);
    expect(nextCycleDay({ date: "2026-10-01", cycleDay: 1 }, "2026-10-02", "2026-10-01")).toBe(2);
    expect(nextCycleDay({ date: "2026-10-06", cycleDay: 6 }, "2026-10-07", "2026-10-06")).toBe(7);
    expect(nextCycleDay({ date: "2026-10-07", cycleDay: 7 }, "2026-10-08", "2026-10-07")).toBe(1);
    expect(nextCycleDay({ date: "2026-10-09", cycleDay: 2 }, "2026-10-11", "2026-10-10")).toBe(1);
    expect(nextCycleDay({ date: "2026-12-31", cycleDay: 3 }, "2027-01-01", "2026-12-31")).toBe(4);
  });
  it("10/1~10/11(10/10 빠짐)은 1~7, 1, 2, (없음), 1", async () => {
    const { nextCycleDay } = await import("@/lib/game");
    const { previousDay } = await import("@/lib/kst");
    const days = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "11"].map((d) => `2026-10-${d}`);
    let last: { date: string; cycleDay: number } | null = null;
    const got = days.map((d) => {
      const cycleDay = nextCycleDay(last, d, previousDay(d));
      last = { date: d, cycleDay };
      return cycleDay;
    });
    expect(got).toEqual([1, 2, 3, 4, 5, 6, 7, 1, 2, 1]);
  });
  it("달력: 2026년 10월은 목요일 시작, 31일", async () => {
    const { monthCalendar } = await import("@/lib/kst");
    const c = monthCalendar("2026-10-12");
    expect(c).toMatchObject({ year: 2026, month: 10, start: "2026-10-01", end: "2026-10-31" });
    expect(c.cells.slice(0, 5)).toEqual([null, null, null, null, "2026-10-01"]);
    expect(c.cells).toHaveLength(35);
  });
});
