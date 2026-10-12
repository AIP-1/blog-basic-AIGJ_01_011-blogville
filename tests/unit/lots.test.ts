import { describe, expect, it } from "vitest";
import { assignLots, isNeighborLot, lotArea, moveToLot } from "@/lib/town/lots";

const f = (id: string, townLot: number | null = null) => ({ id, townLot });

describe("이웃 집 자리 (TOWN-18)", () => {
  it("고른 자리가 먼저, 안 고른 이웃은 남은 자리를 작은 번호부터 즐겨찾기한 순서대로", () => {
    const lots = assignLots([f("a"), f("b", 1), f("c"), f("d", 3)]);
    expect(lots.map((x) => [x.id, x.lot])).toEqual([
      ["a", 2],
      ["b", 1],
      ["c", 4],
      ["d", 3],
    ]);
  });
  it("같은 자리를 둘이 고르면 먼저 즐겨찾기한 이웃, 이상한 번호는 안 고른 것으로", () => {
    const lots = assignLots([f("a", 5), f("b", 5), f("c", 11)]);
    expect(lots.map((x) => [x.id, x.lot])).toEqual([
      ["a", 5],
      ["b", 1],
      ["c", 2],
    ]);
  });
  it("자리는 10개까지", () => {
    const many = Array.from({ length: 12 }, (_, i) => f(`n${i}`));
    expect(assignLots(many)).toHaveLength(10);
  });
  it("자리 번호와 있는 곳", () => {
    expect([0, 1, 10, 11, 2.5].map(isNeighborLot)).toEqual([false, true, true, false, false]);
    expect([1, 5, 9].map(lotArea)).toEqual(["서쪽 길", "동쪽 길", "남쪽 들판"]);
  });
  it("자리 옮기기: 빈 자리면 그 이웃만, 다른 이웃이 살면 맞바꾸고 나머지는 그대로", () => {
    const now = [
      { id: "a", lot: 1 },
      { id: "b", lot: 2 },
      { id: "c", lot: 3 },
    ];
    expect(moveToLot(now, "a", 7)).toEqual([
      { id: "a", lot: 7 },
      { id: "b", lot: 2 },
      { id: "c", lot: 3 },
    ]);
    expect(moveToLot(now, "c", 1)).toEqual([
      { id: "a", lot: 3 },
      { id: "b", lot: 2 },
      { id: "c", lot: 1 },
    ]);
  });
});
