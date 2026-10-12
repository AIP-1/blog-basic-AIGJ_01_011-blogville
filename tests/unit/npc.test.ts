import { describe, expect, it } from "vitest";
import { HOUSE_LOTS, lotFront, type Point } from "@/lib/town/layout";
import { createNpcs, HOME_CLEARANCE, nearestNode, npcGraph, segmentClear, updateNpcs } from "@/lib/town/npc";
import { townLayout } from "@/lib/town/structures";

const houses = Array.from({ length: 10 }, (_, i) => ({ lot: i + 1, nickname: `이웃${i + 1}`, slug: `n${i + 1}`, blogTitle: "", stage: 1, roof: "#c0392b", mine: false }));
const { structures, walls } = townLayout(houses, true);
const bodies = [...walls, ...structures.flatMap((s) => (s.body ? [s.body] : []))];
const home = lotFront(0);
const stops = HOUSE_LOTS.map((_, i) => lotFront(i));
const graph = npcGraph(bodies, home, stops);

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a * 1103515245 + 12345) % 2147483648;
    return a / 2147483648;
  };
}

const onSomeLink = (p: Point) =>
  graph.links.some((ns, i) =>
    ns.some((j) => {
      const [a, b] = [graph.nodes[i], graph.nodes[j]];
      const t = a.x === b.x ? Math.abs(p.x - a.x) < 0.01 && p.y >= Math.min(a.y, b.y) - 0.01 && p.y <= Math.max(a.y, b.y) + 0.01 : Math.abs(p.y - a.y) < 0.01 && p.x >= Math.min(a.x, b.x) - 0.01 && p.x <= Math.max(a.x, b.x) + 0.01;
      return t;
    }),
  );

describe("걸어 다니는 이웃 (TOWN-19)", () => {
  it("길 줄은 막히지 않고 내 집 앞 190px 안을 지나지 않는다", () => {
    expect(graph.links.flat().length).toBeGreaterThan(20);
    graph.links.forEach((ns, i) => {
      for (const j of ns) {
        expect(segmentClear(graph.nodes[i], graph.nodes[j], bodies)).toBe(true);
        expect(Math.hypot(graph.nodes[i].x - home.x, graph.nodes[i].y - home.y)).toBeGreaterThanOrEqual(HOME_CLEARANCE);
      }
    });
  });

  it("이웃 집 1~10번 앞마다 가까운 길 점이 있다", () => {
    for (let lot = 1; lot <= 10; lot++) {
      const n = nearestNode(graph, lotFront(lot));
      expect(n).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(graph.nodes[n].x - lotFront(lot).x, graph.nodes[n].y - lotFront(lot).y)).toBeLessThan(60);
    }
  });

  it("30초 동안 걸어도 늘 길 위에 있고, 걷다가 갈림길에서 쉰다", () => {
    const random = seeded(7);
    const npcs = createNpcs(graph, houses, random);
    expect(npcs).toHaveLength(10);
    const start = npcs.map((n) => ({ ...n.pos }));
    let walked = 0;
    let rested = 0;
    for (let t = 0; t < 30; t += 1 / 30) {
      updateNpcs(npcs, graph, 1 / 30, random);
      for (const n of npcs) {
        expect(onSomeLink(n.pos)).toBe(true);
        if (n.walking) walked++;
        else rested++;
      }
    }
    expect(walked).toBeGreaterThan(rested);
    expect(rested).toBeGreaterThan(0);
    expect(npcs.filter((n, i) => Math.hypot(n.pos.x - start[i].x, n.pos.y - start[i].y) > 50).length).toBeGreaterThan(5);
  });

  it("길이 없으면 아무도 걷지 않는다", () => {
    expect(createNpcs({ nodes: [], links: [] }, houses, Math.random)).toEqual([]);
  });
});
