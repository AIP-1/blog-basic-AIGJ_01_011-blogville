import { describe, expect, it } from "vitest";
import { cherryTreeArt, fenceArt, fencePostArt, flowerBedArt, rosesArchArt } from "@/lib/art/town";
import { FARM_POS, GARDEN, GARDEN_GATE, HOUSE_LOTS, inGarden, lotFront, step, type Point } from "@/lib/town/layout";
import { GARDEN_CLEARANCE, npcGraph } from "@/lib/town/npc";
import { townLayout, type TownHouseInput } from "@/lib/town/structures";

// 내 정원 (TOWN-20), specs/053-garden
const house = (lot: number, mine = false): TownHouseInput => ({ lot, slug: `blog${lot}`, nickname: `주민${lot}`, blogTitle: `블로그 ${lot}`, stage: 1, roof: "#c0392b", mine });
const houses = [house(0, true), ...Array.from({ length: 10 }, (_, i) => house(i + 1))];
const { structures, entrances, walls } = townLayout(houses, true);
const bodies = [...walls, ...structures.flatMap((s) => (s.body ? [s.body] : []))];

/** 한 방향으로 `n`걸음 (한 걸음 4px) */
function walk(from: Point, dx: number, dy: number, n = 200): Point {
  let p = from;
  for (let i = 0; i < n; i++) p = step(p, { x: dx * 4, y: dy * 4 }, bodies);
  return p;
}

describe("내 정원 (TOWN-20)", () => {
  it("내 집·우체통·동물 농장과 그 입구가 정원 안에 있다", () => {
    for (const id of ["house:0", "mailbox:0", "farm"]) {
      const s = structures.find((x) => x.id === id)!;
      expect(inGarden(s)).toBe(true);
    }
    for (const id of ["house:0", "mailbox:0", "farm"]) {
      const e = entrances.find((x) => x.id === id)!;
      expect(inGarden(e)).toBe(true);
    }
    expect(inGarden(FARM_POS)).toBe(true);
  });

  it("정원 안에는 내 집·우체통·농장과 정원 꾸밈만 있다", () => {
    const inside = structures.filter((s) => inGarden(s) && !(s.y === GARDEN.y));
    for (const s of inside) expect(s.id).toMatch(/^(house:0|mailbox:0|farm|fence:|flowerbed:|cherry:)/);
    expect(structures.filter((s) => s.id.startsWith("tree:")).every((t) => !inGarden(t, 30))).toBe(true);
    for (let lot = 1; lot < HOUSE_LOTS.length; lot++) expect(inGarden(HOUSE_LOTS[lot], 40)).toBe(false);
  });

  it("장미 아치 문으로만 들어간다", () => {
    expect(structures.find((s) => s.id === "garden-arch")!.label).toBe("내 정원");
    // 문으로 들어가 집 옆을 돌아 집 앞까지
    let p = walk({ x: GARDEN_GATE.x, y: GARDEN.y - 40 }, 0, 1, 40);
    expect(p.y).toBe(GARDEN.y + 120);
    p = walk(walk(walk(p, 1, 0, 22), 0, 1, 30), -1, 0, 22);
    expect(p).toEqual(lotFront(0));
    // 울타리 앞에서 내려가면 막힌다 (왼쪽·오른쪽)
    for (const x of [GARDEN.x + 60, GARDEN_GATE.x - 70, GARDEN_GATE.x + 70, GARDEN.x + GARDEN.width - 60]) {
      expect(walk({ x, y: GARDEN.y - 40 }, 0, 1).y).toBeLessThanOrEqual(GARDEN.y - 8);
    }
    // 안에서 옆으로 가도 옆 울타리에 막힌다
    expect(walk({ x: 900, y: 1200 }, -1, 0).x).toBeGreaterThan(GARDEN.x);
    expect(walk({ x: 1100, y: 1300 }, 1, 0).x).toBeLessThan(GARDEN.x + GARDEN.width);
    // 집 앞에서 농장 앞까지 걸어간다
    expect(walk(lotFront(0), 1, 0, 80).x).toBeGreaterThanOrEqual(FARM_POS.x);
  });

  it("걸어 다니는 이웃의 길은 정원(둘레 60px 포함)에 없다", () => {
    const graph = npcGraph(bodies, lotFront(0), HOUSE_LOTS.map((_, i) => lotFront(i)));
    graph.nodes.forEach((n, i) => {
      if (graph.links[i].length > 0) expect(inGarden(n, GARDEN_CLEARANCE)).toBe(false);
    });
  });

  it("친구 마을에서는 그 주인의 정원", () => {
    const friend = townLayout([house(0)], true).structures.find((s) => s.id === "garden-arch")!;
    expect(friend.label).toBe("주민0의 정원");
  });

  it("정원 그림은 줄 길이가 고르고 팔레트에 있는 글자만 쓴다", () => {
    for (const a of [fenceArt(), fencePostArt(), rosesArchArt(), flowerBedArt(0), flowerBedArt(1), cherryTreeArt()]) {
      expect(new Set(a.rows.map((r) => r.length)).size).toBe(1);
      for (const ch of a.rows.join("")) if (ch !== ".") expect(a.palette[ch]).toBeDefined();
    }
  });
});
