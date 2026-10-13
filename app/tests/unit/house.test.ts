import { describe, expect, it } from "vitest";
import { furnitureSlots, houseInfo, houseStage, houseSummary, HOUSE_ERRORS, parseSlot, slotOpenLevel } from "@/lib/house";

describe("집 단계·칸 (SHOP-05·TOWN-04)", () => {
  it("10레벨마다 한 단계, 1~10단계", () => {
    expect([1, 9, 10, 19, 20, 50, 99].map(houseStage)).toEqual([1, 1, 2, 2, 3, 6, 10]);
  });
  it("칸 수: 1단계 4, 2단계 6, 3단계부터 8", () => {
    expect([1, 2, 3, 10].map(furnitureSlots)).toEqual([4, 6, 8, 8]);
  });
  it("이름과 다음 단계 레벨, 안내 줄", () => {
    expect(houseInfo(1)).toEqual({ stage: 1, name: "작은 오두막", slots: 4, nextLevel: 10 });
    expect(houseInfo(10)).toEqual({ stage: 2, name: "창문 많은 집", slots: 6, nextLevel: 20 });
    expect(houseInfo(95)).toEqual({ stage: 10, name: "마을 최고 저택", slots: 8, nextLevel: null });
    expect(houseSummary(2, houseInfo(1))).toBe("가구 2/4칸 · Lv.10에 집이 커져요");
    expect(houseSummary(8, houseInfo(99))).toBe("가구 8/8칸");
  });
  it("열리지 않은 칸 문구와 칸 번호 요청", () => {
    expect(HOUSE_ERRORS.locked(10)).toBe("Lv.10이 되면 집이 커져서 이 자리를 쓸 수 있어요.");
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(slotOpenLevel)).toEqual([1, 1, 1, 1, 10, 10, 20, 20]);
    expect(HOUSE_ERRORS.locked(20)).toBe("Lv.20이 되면 집이 커져서 이 자리를 쓸 수 있어요.");
    expect(["0", "7"].map(parseSlot)).toEqual([0, 7]);
    expect(["8", "-1", "01", "a", "", null, 3].map(parseSlot)).toEqual(Array(7).fill(null));
  });
});
