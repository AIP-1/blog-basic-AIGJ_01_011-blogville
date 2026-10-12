import { describe, expect, it } from "vitest";
import { animalStage, FARM_ERRORS, grownMessage, levelEggs, pickSpecies, SPECIES, SPECIES_CODES } from "@/lib/farm";
import { findArt } from "@/lib/art";

describe("동물 농장 규칙 (TOWN-09)", () => {
  it("부화 비중: 0~39 병아리, 40~69 토끼, 70~89 아기 돼지, 90~99 송아지", () => {
    const counts: Record<string, number> = {};
    for (let roll = 0; roll < 100; roll++) counts[pickSpecies(roll)] = (counts[pickSpecies(roll)] ?? 0) + 1;
    expect(counts).toEqual({ chick: 40, rabbit: 30, piglet: 20, calf: 10 });
    expect(pickSpecies(39)).toBe("chick");
    expect(pickSpecies(40)).toBe("rabbit");
    expect(pickSpecies(99)).toBe("calf");
  });
  it("종류 표: 흔할수록 빨리 자라고 보상이 작다", () => {
    expect(SPECIES_CODES.map((c) => SPECIES[c].growth)).toEqual([60, 90, 120, 160]);
    expect(SPECIES_CODES.map((c) => [SPECIES[c].exp, SPECIES[c].coin])).toEqual([
      [50, 20],
      [80, 30],
      [110, 50],
      [160, 80],
    ]);
  });
  it("단계: 1/3 미만 아기, 다 자라기 전 청소년, 다 차면 어른", () => {
    expect(animalStage("chick", 0)).toBe("baby");
    expect(animalStage("chick", 19)).toBe("baby");
    expect(animalStage("chick", 20)).toBe("teen");
    expect(animalStage("chick", 59)).toBe("teen");
    expect(animalStage("chick", 60)).toBe("adult");
  });
  it("레벨 보상 알: 5레벨마다, 받은 것은 빼고", () => {
    expect(levelEggs(4, [])).toEqual([]);
    expect(levelEggs(5, [])).toEqual([5]);
    expect(levelEggs(17, [10])).toEqual([5, 15]);
  });
  it("문구 조사", () => {
    expect(grownMessage("chick")).toBe("🎉 병아리가 다 자랐어요! 경험치 +50, 🪙 +20");
    expect(grownMessage("calf")).toBe("🎉 송아지가 다 자랐어요! 경험치 +160, 🪙 +80");
    expect(FARM_ERRORS.cared("feed")).toBe("오늘은 이미 밥 주기를 했어요");
    expect(FARM_ERRORS.coins(30)).toBe("코인이 30개 부족해요");
  });
  it("알과 동물 4종은 16×16 그림이 있다", () => {
    for (const key of ["animal.egg", ...SPECIES_CODES.map((c) => `animal.${c}`)]) {
      const art = findArt(key)!;
      expect(art.rows).toHaveLength(16);
      for (const row of art.rows) {
        expect(row).toHaveLength(16);
        for (const ch of row) if (ch !== ".") expect(art.palette[ch]).toBeDefined();
      }
    }
  });
});
