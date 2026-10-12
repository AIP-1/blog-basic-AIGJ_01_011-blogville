import { describe, expect, it } from "vitest";
import { houseArt, HOUSE_ART_WIDTH, ROOF_COLORS, roofColor } from "@/lib/art/town";
import { feetRect, HOUSE_LOTS, INTERACT_DISTANCE, lotFront, nearestEntrance, normalize, overlaps, shortName, START_POS, step, WORLD, type Point } from "@/lib/town/layout";
import { entrancePrompt, townLayout, type TownHouseInput } from "@/lib/town/structures";

const house = (lot: number, mine = false): TownHouseInput => ({ lot, slug: `blog${lot}`, nickname: `주민${lot}`, blogTitle: `블로그 ${lot}`, stage: 1, roof: ROOF_COLORS[0], mine });

describe("마을 이동 (TOWN-02)", () => {
  it("대각선도 같은 속도", () => {
    const d = normalize(1, 1);
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(normalize(0, 0)).toEqual({ x: 0, y: 0 });
  });
  it("벽에 막힌 축만 멈추고 다른 축으로 미끄러진다, 마을 밖으로는 못 나간다", () => {
    const wall = { x: 100, y: 0, width: 20, height: 400 };
    expect(step({ x: 80, y: 200 }, { x: 10, y: 5 }, [wall])).toEqual({ x: 80, y: 205 });
    expect(step({ x: 20, y: 200 }, { x: -10, y: 0 }, [])).toEqual({ x: 20, y: 200 });
    expect(step({ x: WORLD.width - 20, y: WORLD.height }, { x: 0, y: 5 }, [])).toEqual({ x: WORLD.width - 20, y: WORLD.height });
  });
  it("입구는 90px 안에서 가장 가까운 것", () => {
    const es = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 50, y: 0 },
    ];
    expect(nearestEntrance({ x: 40, y: 0 }, es)?.id).toBe("b");
    expect(nearestEntrance({ x: -INTERACT_DISTANCE - 1, y: 0 }, es)).toBeNull();
  });
  it("이름표는 12자에서 줄인다", () => {
    expect(shortName("가나다라마바사아자차카타")).toBe("가나다라마바사아자차카타");
    expect(shortName("가나다라마바사아자차카타파")).toBe("가나다라마바사아자차카타…");
  });
});

describe("마을 배치 (TOWN-03·04)", () => {
  it("방문자에게 출석 체크·상점은 로그인 안내, 회원은 그 화면", () => {
    const guest = townLayout([], false).entrances;
    expect(entrancePrompt(guest.find((e) => e.id === "shop")!)).toBe("🏪 상점 · Space 로그인하고 이용하기");
    expect(guest.find((e) => e.id === "feed")!.href).toBe("/feed");
    const member = townLayout([house(0, true)], true).entrances;
    expect(member.find((e) => e.id === "attendance")!.href).toBe("/attendance");
    expect(entrancePrompt(member.find((e) => e.id === "house:0")!)).toBe("🏠 내 집 · Space 들어가기");
  });
  it("집이 없는 자리는 빈 집터(0번은 내 집 자리)이고 입구가 없다", () => {
    const { structures, entrances } = townLayout([house(0, true), house(3)], true);
    expect(structures.filter((s) => s.id.startsWith("lot:")).map((s) => s.label)).toEqual(Array(9).fill("빈 집터"));
    expect(entrances.filter((e) => e.id.startsWith("house:")).map((e) => [e.id, e.href, e.label])).toEqual([
      ["house:0", "/@blog0", "🏠 내 집"],
      ["house:3", "/@blog3", "🏠 주민3의 집"],
    ]);
    expect(townLayout([], false).structures.find((s) => s.id === "lot:0")!.label).toBe("내 집 자리");
  });

  it("집이 다 차도 모든 입구에 처음 자리(분수 아래)에서 걸어서 갈 수 있다", () => {
    const { structures, entrances } = townLayout(
      HOUSE_LOTS.map((_, i) => house(i, i === 0)),
      true,
    );
    const bodies = structures.flatMap((s) => (s.body ? [s.body] : []));
    const free = (p: Point) => {
      const f = feetRect(p);
      return f.x >= 0 && f.y >= 0 && f.x + f.width <= WORLD.width && f.y + f.height <= WORLD.height && !bodies.some((b) => overlaps(f, b));
    };
    // 10px 칸으로 걸어서 닿는 곳을 넓혀 간다
    const cell = 10;
    const key = (p: Point) => `${Math.round(p.x / cell)},${Math.round(p.y / cell)}`;
    const seen = new Set([key(START_POS)]);
    const queue: Point[] = [START_POS];
    while (queue.length) {
      const p = queue.pop()!;
      for (const [dx, dy] of [
        [cell, 0],
        [-cell, 0],
        [0, cell],
        [0, -cell],
      ]) {
        const n = { x: p.x + dx, y: p.y + dy };
        if (!seen.has(key(n)) && free(n)) {
          seen.add(key(n));
          queue.push(n);
        }
      }
    }
    expect(free(START_POS)).toBe(true);
    for (const e of entrances) {
      const reached = [...seen].some((k) => {
        const [x, y] = k.split(",").map((v) => Number(v) * cell);
        return Math.hypot(x - e.x, y - e.y) <= INTERACT_DISTANCE - 10;
      });
      expect(reached, e.id).toBe(true);
    }
    // 집 앞(도착 자리)은 몸체에 걸리지 않는다
    for (let i = 0; i < HOUSE_LOTS.length; i++) expect(free(lotFront(i)), `lot ${i}`).toBe(true);
  });
});

describe("집 그림 (TOWN-11)", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("%i단계 그림은 폭이 같고 모든 글자에 색이 있다", (stage) => {
    const art = houseArt(stage, ROOF_COLORS[1]);
    for (const row of art.rows) {
      expect(row).toHaveLength(HOUSE_ART_WIDTH);
      for (const ch of row) if (ch !== ".") expect(art.palette[ch]).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.rows).toHaveLength(stage >= 6 ? 40 : 30);
  });
  it("단계가 오르면 그림이 달라진다, 지붕 색은 블로그 번호로 10가지", () => {
    const drawings = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => houseArt(s, ROOF_COLORS[0]).rows.join("\n")));
    expect(drawings.size).toBe(10);
    expect(new Set(Array.from({ length: 20 }, (_, i) => roofColor(i))).size).toBe(10);
  });
});
