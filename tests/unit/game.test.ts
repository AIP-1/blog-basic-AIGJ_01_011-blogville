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
