import { describe, expect, it } from "vitest";
import { canChooseRoof, currentRoof, isRoofCode, ROOF_CODES, ROOF_HEX, roofOpenLevel, roofOrder, unlockedRoofCount } from "@/lib/roof";

describe("지붕 색 (TOWN-07)", () => {
  it("블로그마다 10색을 한 번씩 담은 순서가 늘 같고, 첫 색은 블로그마다 고루 다르다", () => {
    for (const id of [1, 2, 37, 9999]) {
      const order = roofOrder(id);
      expect(new Set(order).size).toBe(10);
      expect(roofOrder(id)).toEqual(order);
    }
    expect(new Set(Array.from({ length: 200 }, (_, i) => roofOrder(i + 1)[0])).size).toBe(10);
    expect(roofOrder(NaN)).toHaveLength(10);
  });
  it("열린 색은 집 단계 수만큼, 두 번째 색부터 Lv.10·Lv.20…Lv.90", () => {
    expect(unlockedRoofCount(1)).toBe(1);
    expect(unlockedRoofCount(2)).toBe(2);
    expect(unlockedRoofCount(10)).toBe(10);
    expect(unlockedRoofCount(0)).toBe(1);
    expect(unlockedRoofCount(99)).toBe(10);
    expect([0, 1, 9].map(roofOpenLevel)).toEqual([1, 10, 90]);
    const order = roofOrder(5);
    expect(canChooseRoof(5, 1, order[0])).toBe(true);
    expect(canChooseRoof(5, 1, order[1])).toBe(false);
    expect(canChooseRoof(5, 2, order[1])).toBe(true);
  });
  it("저장한 색이 없거나 이상하면 순서의 첫 색", () => {
    expect(currentRoof(5, null)).toBe(roofOrder(5)[0]);
    expect(currentRoof(5, "gold")).toBe(roofOrder(5)[0]);
    expect(currentRoof(5, "mint")).toBe("mint");
    expect(isRoofCode("__proto__")).toBe(false);
    for (const code of ROOF_CODES) expect(ROOF_HEX[code]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
