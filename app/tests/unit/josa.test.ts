import { describe, expect, it } from "vitest";
import { hasFinalConsonant, withJosa } from "@/lib/josa";
import { levelUpText, levelUpTitle, parseLevel } from "@/lib/notifications";

describe("조사 (GAME-06)", () => {
  it("숫자는 읽는 소리로: 일·삼·육·칠·팔·십은 받침, 이·사·오·구는 없음", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 99, 100].map((n) => withJosa(`Lv.${n}`, "이/가"))).toEqual([
      "Lv.1이", "Lv.2가", "Lv.3이", "Lv.4가", "Lv.5가", "Lv.6이", "Lv.7이", "Lv.8이", "Lv.9가", "Lv.10이", "Lv.20이", "Lv.99가", "Lv.100이",
    ]);
  });
  it("한글 끝 글자", () => {
    expect(withJosa("마을", "이/가")).toBe("마을이");
    expect(withJosa("블로그", "을/를")).toBe("블로그를");
    expect(withJosa("집", "은/는")).toBe("집은");
  });
  it("알 수 없는 끝 글자는 null, 조사는 앞의 것", () => {
    expect(hasFinalConsonant("")).toBeNull();
    expect(hasFinalConsonant("abc")).toBeNull();
    expect(withJosa("abc", "이/가")).toBe("abc이");
  });
});

describe("레벨업 문구 (GAME-06)", () => {
  it("Lv.3이·Lv.4가, 99는 최고 레벨", () => {
    expect(levelUpTitle(3)).toBe("Lv.3이 되었어요!");
    expect(levelUpTitle(4)).toBe("Lv.4가 되었어요!");
    expect(levelUpTitle(99)).toBe("최고 레벨 Lv.99가 되었어요!");
    expect(levelUpText(2)).toBe("🎉 Lv.2가 되었어요!");
  });
  it("읽음 요청 레벨은 2~99 정수만", () => {
    expect(["2", "50", "99"].map(parseLevel)).toEqual([2, 50, 99]);
    expect(["0", "1", "100", "abc", "3.5", " 3", "", null, 3].map(parseLevel)).toEqual(Array(9).fill(null));
  });
});
