import { describe, expect, it } from "vitest";
import { segmentClear } from "@/lib/town/npc";
import { feetRect, overlaps, START_POS, type Point, type Rect } from "@/lib/town/layout";
import { findPath, slideStep, WalkGrid } from "@/lib/town/path";
import { FOUNTAIN_BODIES, townLayout } from "@/lib/town/structures";

const { structures, walls, entrances } = townLayout([{ lot: 0, slug: "me", nickname: "나", blogTitle: "내 블로그", stage: 1, roof: "#c0392b", mine: true }], true);
const bodies = [...walls, ...structures.flatMap((s) => (s.body ? [s.body] : []))];
const boardDoor = entrances.find((e) => e.id === "feed")!;

/** 길의 모든 선분이 몸체를 지나지 않는다 */
const clearPath = (from: Point, path: Point[], against: readonly Rect[] = bodies) => {
  let at = from;
  for (const p of path) {
    if (!segmentClear(at, p, against)) return false;
    at = p;
  }
  return true;
};

describe("클릭 이동 길찾기 (A1)", () => {
  it("분수 아래 처음 자리에서 게시판 문 앞까지 분수를 돌아가는 길", () => {
    const path = findPath(bodies, START_POS, boardDoor)!;
    expect(path.length).toBeGreaterThan(0);
    expect(clearPath(START_POS, path, FOUNTAIN_BODIES)).toBe(true);
    expect(clearPath(START_POS, path)).toBe(true);
    const end = path.at(-1)!;
    expect(Math.hypot(end.x - boardDoor.x, end.y - boardDoor.y)).toBeLessThan(1);
  });

  it("곧게 갈 수 있으면 점 하나, 이미 닿아 있으면 빈 목록", () => {
    const to = { x: START_POS.x + 120, y: START_POS.y + 20 };
    expect(findPath(bodies, START_POS, to)).toEqual([to]);
    expect(findPath(bodies, START_POS, START_POS)).toEqual([]);
  });

  it("막힌 자리(분수 한가운데)를 누르면 가장 가까운 빈 칸까지", () => {
    const path = findPath(bodies, START_POS, { x: 1000, y: 815 })!;
    expect(path.length).toBeGreaterThan(0);
    const end = path.at(-1)!;
    expect(bodies.some((b) => overlaps(feetRect(end), b))).toBe(false);
    expect(Math.hypot(end.x - 1000, end.y - 815)).toBeLessThan(60);
  });

  it("빈 자리인데 그 칸 가운데가 막혀 있어도 그 자리까지 간다", () => {
    for (const to of [
      { x: 1105, y: 527 },
      { x: 786, y: 1102 },
      { x: 896, y: 1082 },
      { x: 1603, y: 1324 },
    ]) {
      const grid = new WalkGrid(bodies);
      expect(grid.free(to)).toBe(true);
      const path = grid.find(START_POS, to);
      expect(path, `${to.x},${to.y}`).not.toBeNull();
      expect(path!.at(-1)).toEqual(to);
      expect(clearPath(START_POS, path!)).toBe(true);
      let at = START_POS;
      for (const p of path!) {
        expect(grid.clear(at, p)).toBe(true);
        at = p;
      }
    }
  });

  it("둘러싸인 곳에는 길이 없다", () => {
    const box = [
      { x: 900, y: 900, width: 200, height: 10 },
      { x: 900, y: 1090, width: 200, height: 10 },
      { x: 900, y: 900, width: 10, height: 200 },
      { x: 1090, y: 900, width: 10, height: 200 },
    ];
    expect(new WalkGrid(box).find({ x: 1000, y: 1050 }, { x: 300, y: 300 })).toBeNull();
  });
});

describe("분수 둘레 미끄러지기 (A1)", () => {
  const hold = (from: Point, delta: Point, seconds: number) => {
    let p = from;
    for (let t = 0; t < seconds; t += 1 / 30) p = slideStep(p, { x: delta.x * (230 / 30), y: delta.y * (230 / 30) }, bodies);
    return p;
  };
  it("처음 자리에서 ↑를 2.5초 누르면 분수를 돌아 북쪽으로 간다", () => {
    expect(hold(START_POS, { x: 0, y: -1 }, 2.5).y).toBeLessThan(800);
  });
  it("분수 한가운데 아래에서 ↑는 막힌다 (옆으로 비켜 설 곳이 멀다)", () => {
    const p = hold({ x: 1000, y: 900 }, { x: 0, y: -1 }, 1);
    expect(p.x).toBe(1000);
    expect(p.y).toBeGreaterThanOrEqual(856);
  });
});
