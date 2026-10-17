import { describe, expect, it } from "vitest";
import { assignLots, isNeighborLot, lotArea, moveToLot, pickSuggestions, suggestionLots } from "@/lib/town/lots";
import { dailyPick } from "@/lib/town/plaza";

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

describe("이사 올 이웃 (plaza-upgrade-2 B1)", () => {
  it("빈 자리 뒤쪽 번호부터 3곳, 4번은 늘 비워 둔다", () => {
    // 절벽 아래 9·10번은 빼고
    expect(suggestionLots([])).toEqual([8, 7, 6]);
    expect(suggestionLots([10, 8])).toEqual([7, 6, 5]);
    expect(suggestionLots([5, 6, 7, 8, 9, 10])).toEqual([3, 2, 1]);
    expect(suggestionLots([1, 2, 3, 5, 6, 7, 8, 9, 10])).toEqual([]);
    expect(suggestionLots([1, 2, 3, 5, 6, 7, 8])).toEqual([]);
    expect(suggestionLots([1, 2, 5, 6, 7, 8])).toEqual([3]);
  });

  it("앞 묶음 후보가 먼저, 겹치거나 뺄 후보는 빼고 n명까지", () => {
    const id = (x: string) => x;
    const keep = (xs: readonly string[]) => [...xs];
    expect(pickSuggestions([["a", "b"], ["b", "c"], ["d", "e"]], id, new Set(["a"]), 3, keep)).toEqual(["b", "c", "d"]);
    expect(pickSuggestions([["a"], []], id, new Set(), 3, keep)).toEqual(["a"]);
    expect(pickSuggestions([["a", "b", "c", "d"]], id, new Set(), 2, keep)).toEqual(["a", "b"]);
  });

  it("하루 씨앗(dailyPick)으로 고르면 같은 날 같은 회원은 같은 후보, 다른 회원은 대개 다르다", () => {
    const pool = Array.from({ length: 40 }, (_, i) => ({ id: `u${i}`, blogId: i + 1 }));
    const pick = (seed: string) => (items: readonly (typeof pool)[number][]) => dailyPick(items, seed, (r) => r.blogId, items.length);
    const choose = (seed: string) => pickSuggestions([pool], (r) => r.id, new Set(), 3, pick(seed)).map((r) => r.id);
    expect(choose("2026-10-17:me")).toEqual(choose("2026-10-17:me"));
    // 입력 순서가 바뀌어도 같다
    const reversed = pickSuggestions([[...pool].reverse()], (r) => r.id, new Set(), 3, pick("2026-10-17:me")).map((r) => r.id);
    expect(reversed).toEqual(choose("2026-10-17:me"));
    expect(choose("2026-10-17:you")).not.toEqual(choose("2026-10-17:me"));
    expect(choose("2026-10-18:me")).not.toEqual(choose("2026-10-17:me"));
  });
});
