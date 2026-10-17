import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cherryTreeArt, houseArt, HOUSE_ART_WIDTH, lanternArt } from "@/lib/art/town";
import { CLIFF_FACE, CLIFF_LINES, heightAt, onStairs, stairEnds, STAIRS, TERRAIN_WALLS } from "@/lib/town/terrain";
import { ROOF_HEX } from "@/lib/roof";
import { TOWN_CELL } from "@/lib/art/town";
import {
  feetRect,
  HOUSE_LOTS,
  INTERACT_DISTANCE,
  lotFront,
  MAX_FRAME_SECONDS,
  MAX_STEP_SECONDS,
  nearestEntrance,
  normalize,
  overlaps,
  shortName,
  SPEED,
  START_POS,
  step,
  subSteps,
  WORLD,
  type Point,
} from "@/lib/town/layout";
import {
  artSize,
  EMPTY_LOT_HINT,
  entranceOwner,
  entrancePrompt,
  FOUNTAIN_BODIES,
  lanternBrightness,
  lanternPlacements,
  lanternSlots,
  mailboxLot,
  onArt,
  structureAt,
  townLayout,
  townSpots,
  type TownHouseInput,
} from "@/lib/town/structures";

const house = (lot: number, mine = false): TownHouseInput => ({ lot, slug: `blog${lot}`, nickname: `주민${lot}`, blogTitle: `블로그 ${lot}`, stage: 1, roof: ROOF_HEX.red, mine });

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
    // 회원이 아직 고르지 않은 0번 자리 (방문자는 '여기에 내 집 짓기' 흐린 집, A6)
    expect(townLayout([], true).structures.find((s) => s.id === "lot:0")!.label).toBe("내 집 자리");
  });

  it("집이 다 차도 모든 입구에 처음 자리(분수 아래)에서 걸어서 갈 수 있다", () => {
    const { structures, entrances, walls } = townLayout(
      HOUSE_LOTS.map((_, i) => house(i, i === 0)),
      true,
    );
    const bodies = [...walls, ...structures.flatMap((s) => (s.body ? [s.body] : []))];
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
    // 높낮이 (TOWN-05): 세 단 모두와 계단 양끝에 걸어서 닿는다
    const reach = (p: Point) => seen.has(key(p));
    for (const st of STAIRS) {
      const { top, bottom } = stairEnds(st);
      expect(reach(top), `${st.id} 위`).toBe(true);
      expect(reach(bottom), `${st.id} 아래`).toBe(true);
    }
    expect([...seen].some((k) => heightAt(Number(k.split(",")[1]) * cell) === 2)).toBe(true);
    expect([...seen].some((k) => heightAt(Number(k.split(",")[1]) * cell) === 0)).toBe(true);
    // 계단이 아닌 곳의 절벽 앞면은 걸을 수 없다
    for (const line of CLIFF_LINES) expect(free({ x: 1000, y: line + CLIFF_FACE / 2 })).toBe(false);
  });
});

describe("걷는 빠르기는 프레임 수와 상관없다", () => {
  /** 빈 땅에서 `seconds`초 동안 `fps`로 오른쪽으로 걸은 거리 (게임과 같이 프레임마다 잘게 나눠 `step`) */
  const walk = (fps: number, seconds: number) => {
    let p = { x: 200, y: 800 };
    for (let f = 0; f < Math.round(seconds * fps); f++) for (const dt of subSteps(1 / fps)) p = step(p, { x: SPEED * dt, y: 0 }, []);
    return p.x - 200;
  };
  it("느린 화면(10·15fps)도 60fps와 같은 거리를 걷는다", () => {
    expect(walk(60, 0.6)).toBeCloseTo(SPEED * 0.6, 5);
    expect(walk(15, 0.6)).toBeCloseTo(SPEED * 0.6, 5);
    expect(walk(10, 0.6)).toBeCloseTo(SPEED * 0.6, 5);
  });
  it("한 걸음은 1/30초 이하, 한 프레임은 0.25초까지 (탭을 비웠다 돌아와도 순간 이동하지 않는다)", () => {
    const steps = subSteps(0.1);
    expect(steps.every((dt) => dt <= MAX_STEP_SECONDS + 1e-12)).toBe(true);
    expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(0.1);
    expect(subSteps(5).reduce((a, b) => a + b, 0)).toBeCloseTo(MAX_FRAME_SECONDS);
    expect(subSteps(0)).toEqual([]);
    expect(subSteps(-0.01)).toEqual([]);
  });
  it("걸음을 똑같이 나눠 끝에 아주 짧은 걸음이 남지 않는다 (느린 화면에서 걷는 그림이 멈춤으로 깜빡이지 않게)", () => {
    for (const frame of [0.0667, 0.1667, 0.05, 0.034]) {
      const steps = subSteps(frame);
      expect(Math.min(...steps)).toBeCloseTo(Math.max(...steps), 12);
      expect(steps.every((dt) => dt <= MAX_STEP_SECONDS + 1e-12)).toBe(true);
      expect(steps.reduce((a, b) => a + b, 0)).toBeCloseTo(frame, 12);
    }
  });
});

describe("건물·집을 누르는 자리", () => {
  const { structures, entrances } = townLayout([house(3)], true);
  const home = structures.find((s) => s.id === "house:3")!;
  const { width, height } = artSize(home.art);
  it("그림의 칠한 칸만 그 집이고, 그림 상자 안이라도 양옆 풀밭은 아니다", () => {
    // 집 몸통 가운데
    expect(structureAt(structures, { x: home.x, y: home.y - 20 })?.id).toBe("house:3");
    // 그림 상자 왼쪽 끝 칸 (빈 칸): 풀밭
    const edge = { x: home.x - width / 2 + 2, y: home.y - 10 };
    expect(onArt(home, edge)).toBe(false);
    expect(structureAt(structures, edge)?.id).not.toBe("house:3");
    // 지붕 위 빈 줄
    expect(onArt(home, { x: home.x - width / 2 + TOWN_CELL * 3, y: home.y - height + 2 })).toBe(false);
  });
  it("겹치면 앞(아랫변이 아래)에 그린 것", () => {
    const back = { id: "back", art: home.art, x: 500, y: 500 };
    const front = { id: "front", art: home.art, x: 500, y: 520 };
    expect(structureAt([front, back], { x: 500, y: 495 })?.id).toBe("front");
  });
  it("입구 안내는 그 건물·집 이름표 자리 (게시판 두 입구는 게시판), 우체통·빈 집터는 입구 위", () => {
    const owner = (id: string) => entranceOwner(entrances.find((e) => e.id === id)!, structures)?.id;
    expect(owner("house:3")).toBe("house:3");
    expect(owner("shop")).toBe("shop");
    expect(owner("feed")).toBe("board");
    expect(owner("attendance")).toBe("board");
    expect(owner("mailbox:3")).toBeUndefined();
    const lots = townLayout([], true, false, true);
    expect(entranceOwner(lots.entrances.find((e) => e.id === "lot:4")!, lots.structures)).toBeUndefined();
  });
});

describe("집 옆·뒤에서 들어가기", () => {
  it("앞문까지 가지 않아도 집 옆·뒤 가까이면 그 집 입구, 멀면 없다", () => {
    const { entrances } = townLayout([house(3)], true);
    const lot = HOUSE_LOTS[3];
    // 집 뒤 (앞문에서 100px 넘게 떨어짐)
    const back = { x: lot.x, y: lot.y - 80 };
    expect(Math.hypot(lotFront(3).x - back.x, lotFront(3).y - back.y)).toBeGreaterThan(INTERACT_DISTANCE);
    expect(nearestEntrance(back, entrances)?.id).toBe("house:3");
    // 집 왼쪽 옆
    expect(nearestEntrance({ x: lot.x - 80, y: lot.y - 40 }, entrances)?.id).toBe("house:3");
    // 집에서 멀면 없다
    expect(nearestEntrance({ x: lot.x, y: lot.y - 200 }, entrances)).toBeNull();
  });
  it("집 둘레 안이라도 더 가까운 우체통이 먼저다", () => {
    const { entrances } = townLayout([house(3)], true);
    const box = entrances.find((e) => e.id === "mailbox:3")!;
    expect(nearestEntrance({ x: box.x, y: box.y }, entrances)?.id).toBe("mailbox:3");
  });
});

describe("집 그림 (TOWN-11)", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("%i단계 그림은 폭이 같고 모든 글자에 색이 있다", (stage) => {
    const art = houseArt(stage, ROOF_HEX.blue);
    for (const row of art.rows) {
      expect(row).toHaveLength(HOUSE_ART_WIDTH);
      for (const ch of row) if (ch !== ".") expect(art.palette[ch]).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(art.rows).toHaveLength(stage >= 6 ? 40 : 30);
  });
  it("단계가 오르면 그림이 달라진다", () => {
    const drawings = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => houseArt(s, ROOF_HEX.red).rows.join("\n")));
    expect(drawings.size).toBe(10);
  });
});

describe("☰ 텔레포트 목록 (TOWN-12)", () => {
  it("마을 5곳 + 집 11자리, 집은 입구 앞 좌표·블로그 주소, 빈 집터는 못 고르고 회원에게만 ⭐ 안내", () => {
    const member = townSpots([house(0, true), house(2)], true);
    expect(member.places.map((s) => s.label)).toEqual(["⛲ 광장 분수", "🏮 줄등", "📋 마을 게시판", "📝 이번 주 글감", "🏪 상점", "👗 옷가게", "💇 미용실", "🐮 동물 농장", "🎣 낚시터"]);
    expect(member.houses).toHaveLength(11);
    expect(member.houses[0]).toMatchObject({ label: "🏠 내 집", sub: "블로그 0", enabled: true, slug: "blog0", ...lotFront(0) });
    expect(member.houses[2]).toMatchObject({ label: "🏠 주민2의 집", enabled: true, slug: "blog2" });
    expect(member.houses[1]).toMatchObject({ label: "빈 집터", sub: EMPTY_LOT_HINT, enabled: false, slug: null });
    const guest = townSpots([house(1)], false);
    expect(guest.houses[0]).toMatchObject({ label: "🏡 여기에 내 집 짓기", sub: null, enabled: true, ...lotFront(0) });
    expect(townSpots([], true).houses[0]).toMatchObject({ label: "내 집 자리", sub: null, enabled: false });
    expect(guest.houses[2]).toMatchObject({ label: "빈 집터", sub: null });
  });
  it("텔레포트 자리는 몸체에 걸리지 않는다", () => {
    const { structures } = townLayout(
      HOUSE_LOTS.map((_, i) => house(i, i === 0)),
      true,
    );
    const bodies = structures.flatMap((s) => (s.body ? [s.body] : []));
    const spots = townSpots(
      HOUSE_LOTS.map((_, i) => house(i, i === 0)),
      true,
    );
    for (const s of [...spots.places, ...spots.houses]) expect(bodies.some((b) => overlaps(feetRect(s), b)), s.id).toBe(false);
  });
});

describe("높낮이 (TOWN-05)", () => {
  it("계단은 4곳, 길보다 넓고 앞면 조각과 겹치지 않으며 계단 위는 느리게", () => {
    expect(STAIRS).toHaveLength(4);
    for (const st of STAIRS) {
      expect(st.rect.width).toBeGreaterThan(52);
      const inner = { x: st.rect.x + 8, y: st.rect.y, width: st.rect.width - 16, height: st.rect.height };
      expect(TERRAIN_WALLS.some((w) => overlaps(w, inner))).toBe(false);
      expect(onStairs({ x: st.x, y: st.top + 10 })).toBe(true);
    }
    expect(onStairs({ x: 1000, y: 800 })).toBe(false);
    expect([100, 600, 1500].map(heightAt)).toEqual([2, 1, 0]);
  });
});

describe("집 앞 우체통 (TOWN-13)", () => {
  it("집이 선 자리에만 우체통과 `소식 보기` 입구, 내 우체통은 깃발을 올릴 수 있다", () => {
    const { structures, entrances } = townLayout([house(0, true), house(3)], true, true);
    const boxes = entrances.filter((e) => mailboxLot(e.href) !== null);
    expect(boxes.map((e) => mailboxLot(e.href))).toEqual([0, 3]);
    expect(entrancePrompt(boxes[0])).toBe("📬 내 우체통 · Space 소식 보기");
    expect(entrancePrompt(boxes[1])).toBe("📬 주민3의 우체통 · Space 소식 보기");
    expect(structures.filter((s) => s.id.startsWith("mailbox:"))).toHaveLength(2);
    const mine = structures.find((s) => s.id === "mailbox:0")!;
    expect(Object.values(mine.art.palette)).toContain("#3a6ea5");
    expect(mine.art.rows.join("")).not.toEqual(townLayout([house(0, true)], true, false).structures.find((s) => s.id === "mailbox:0")!.art.rows.join(""));
    expect(Object.values(structures.find((s) => s.id === "mailbox:3")!.art.palette)).toContain("#b8452f");
    expect(mailboxLot("/@abc")).toBeNull();
    expect(mailboxLot("mailbox:x")).toBeNull();
  });
});

describe("이사 올 이웃·방문자 내 집 자리·친구 마을 농장 (A6)", () => {
  it("이사 올 집(suggested)은 흐린 집이고 들어가면 우체통 창, 걷는 이웃이 되지 않는다", () => {
    const houses = [house(0, true), { ...house(3), suggested: true, fresh: true }, house(5)];
    const { structures, entrances } = townLayout(houses, true, false, true);
    const ghost = structures.find((s) => s.id === "house:3")!;
    expect(ghost.alpha).toBe(0.55);
    expect(ghost.lit).toBeUndefined();
    expect(ghost.label).toBe("이사 올 집 · 주민3");
    const door = entrances.find((e) => e.id === "house:3")!;
    expect(door.href).toBe("mailbox:3");
    expect(mailboxLot(door.href)).toBe(3);
    // 빈 집터 자리 고르기 입구는 없다 (집이 서 있다)
    expect(entrances.some((e) => e.href === "lots:3")).toBe(false);
    // 걷는 이웃 (TownGame이 createNpcs에 넘기는 집): 이사 올 집은 빠진다
    const walkers = houses.filter((h) => h.lot > 0 && !h.suggested).map((h) => h.lot);
    expect(walkers).toEqual([5]);
    expect(lanternSlots(houses).map((l) => l.lot)).toEqual([5]);
  });
  it("방문자: 0번 자리에 그날 지붕색의 흐린 집과 '여기에 내 집 짓기' 가입 입구, 정원은 '빈 정원'", () => {
    const { structures, entrances } = townLayout([house(1)], false);
    const home = entrances.find((e) => e.id === "house:0")!;
    expect(home.href).toBe("login");
    expect(home.label).toBe("🏡 여기에 내 집 짓기");
    expect(entrancePrompt(home)).toBe("🏡 여기에 내 집 짓기 · Space 가입하기");
    const ghost = structures.find((s) => s.id === "house:0")!;
    expect(ghost.alpha).toBe(0.55);
    expect(Object.values(ROOF_HEX)).toContain(ghost.art.palette.R);
    expect(structures.find((s) => s.id === "garden-arch")!.label).toBe("빈 정원");
    expect(townLayout([house(0, true)], true).structures.find((s) => s.id === "garden-arch")!.label).toBe("내 정원");
  });
  it("친구 마을(0번이 남의 집): 농장 입구는 그 집 농장 구경, 게임 방은 주인 주소를 이어 받는다", () => {
    const friend = [{ ...house(0), slug: "mint", nickname: "민트" }, house(2)];
    const { entrances } = townLayout(friend, true);
    const href = (id: string) => entrances.find((e) => e.id === id)!.href;
    expect(href("farm")).toBe("/farm?host=mint");
    expect(href("shop")).toBe("/shop?host=mint");
    expect(href("pond")).toBe("/fishing?host=mint");
    expect(href("feed")).toBe("/feed");
    // 내 마을은 그대로
    const mine = townLayout([house(0, true)], true).entrances;
    expect(mine.find((e) => e.id === "farm")!.href).toBe("/farm");
    expect(mine.find((e) => e.id === "shop")!.href).toBe("/shop");
  });
});

describe("게시판 세 입구 (C1 글감)", () => {
  it("마을 소식·이번 주 글감·출석 체크, 가운데가 /prompt", () => {
    const { entrances } = townLayout([], true);
    const board = entrances.filter((e) => ["feed", "prompt", "attendance"].includes(e.id));
    expect(board.map((e) => [e.id, e.href])).toEqual([
      ["feed", "/feed"],
      ["prompt", "/prompt"],
      ["attendance", "/attendance"],
    ]);
    expect(board.map((e) => e.x)).toEqual([935, 1000, 1065]);
    expect(entranceOwner(board[1], townLayout([], true).structures)?.id).toBe("board");
    // 게시판 앞 양쪽에서는 그 문이 가장 가깝다 (e2e 텔레포트 자리)
    expect(nearestEntrance({ x: 940, y: 540 }, entrances)?.id).toBe("feed");
    expect(nearestEntrance({ x: 1060, y: 540 }, entrances)?.id).toBe("attendance");
    expect(nearestEntrance({ x: 1000, y: 530 }, entrances)?.id).toBe("prompt");
  });
});

describe("청사초롱 줄등 (A4)", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();
  const neighbor = (lot: number, hours: number | null) => ({
    ...house(lot),
    fresh: hours !== null && hours < 24,
    recentPosts: hours === null ? [] : [{ id: lot * 10, title: `글 ${lot}`, createdAt: ago(hours) }],
  });
  it("lot 순서로 10개까지, 24시간 안에 글 쓴 집만 켜지고 밝기는 1·0.7·0.4", () => {
    const houses = [house(0, true), ...[10, 3, 1, 2, 4, 5, 6, 7, 8, 9].map((lot, i) => neighbor(lot, [2, 10, 20, 30, null][i % 5]))];
    const slots = lanternSlots(houses, now);
    expect(slots).toHaveLength(10);
    expect(slots.map((s) => s.lot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const s of slots) {
      const h = houses.find((x) => x.lot === s.lot)!;
      expect(s.lit).toBe(h.fresh);
      if (s.lit) expect([1, 0.7, 0.4]).toContain(s.brightness);
      else expect(s.brightness).toBe(0);
    }
    expect(lanternBrightness(ago(1), now)).toBe(1);
    expect(lanternBrightness(ago(9), now)).toBe(0.7);
    expect(lanternBrightness(ago(17), now)).toBe(0.4);
    expect(lanternBrightness(ago(25), now)).toBe(0);
  });
  it("초롱은 줄 네 가닥에 고르게 매달리고, 켜진 초롱 아래에 그 글로 가는 입구", () => {
    const houses = [house(0, true), neighbor(1, 2), neighbor(2, null), neighbor(5, 12)];
    const places = lanternPlacements(3);
    expect(places.map((p) => p.rope)).toEqual([0, 1, 2]);
    const { entrances } = townLayout(houses, true, false, false, undefined, { now });
    const lanterns = entrances.filter((e) => e.id.startsWith("lantern:"));
    expect(lanterns.map((e) => [e.id, e.href])).toEqual([
      ["lantern:1", "/@blog1/10"],
      ["lantern:5", "/@blog5/50"],
      ["lantern:home", "/write"],
    ]);
    expect(entrancePrompt(lanterns[0])).toBe("🏮 주민1 · 글 1 · Space 글 읽기");
    // 내 초롱: 오늘 글을 썼으면 켜지고 내 글로
    const posted = townLayout([{ ...house(0, true), recentPosts: [{ id: 7, title: "오늘 글", createdAt: ago(1) }] }], true, false, false, undefined, { now, homePosted: true });
    expect(posted.entrances.find((e) => e.id === "lantern:home")!.href).toBe("/@blog0/7");
    // 처음 자리(분수 아래)에서는 초롱 입구가 가깝지 않다 (Space가 글을 열지 않는다)
    const many = townLayout([house(0, true), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((l) => neighbor(l, 1))], true, false, false, undefined, { now });
    expect(nearestEntrance(START_POS, many.entrances)).toBeNull();
  });
  it("장대는 분수 몸체 안에 서서 길을 막지 않는다", () => {
    const { structures, walls } = townLayout([], true);
    const mast = structures.find((s) => s.id === "mast")!;
    expect(mast.body).toBeNull();
    expect(FOUNTAIN_BODIES.some((b) => mast.x >= b.x && mast.x <= b.x + b.width && mast.y >= b.y && mast.y <= b.y + b.height)).toBe(true);
    for (const b of FOUNTAIN_BODIES) expect(walls).toContain(b);
  });
  it("초롱 그림: 크기마다 칸 수, 켜면 속이 노랗고 끄면 회색 비단", () => {
    expect([lanternArt(true, "s"), lanternArt(true, "m"), lanternArt(true, "l")].map((a) => [a.rows[0].length, a.rows.length])).toEqual([
      [5, 8],
      [7, 11],
      [9, 13],
    ]);
    expect(lanternArt(true, "m").palette.J).toBe("#ffd56e");
    expect(lanternArt(false, "m").palette.R).toBe("#8c7f74");
    expect(lanternArt(false, "m").palette.B).toBe("#6f7690");
    expect(lanternArt(true, "m").palette.R).toBe("#c8342c");
  });
  it("글 쓴 집은 처마 끝에 소형 초롱 (속은 J 칸), 크기는 그대로", () => {
    const { structures } = townLayout([house(0, true), { ...house(1), fresh: true }], true);
    const lit = structures.find((s) => s.id === "house:1")!;
    expect(lit.art.rows.join("")).toContain("J");
    expect(lit.art.rows).toHaveLength(houseArt(1, ROOF_HEX.red).rows.length);
    expect(structures.find((s) => s.id === "house:0")!.art.rows.join("")).not.toContain("J");
  });
});

describe("계절 (A5)", () => {
  it("마을 그림 팔레트에 Material 기본색(#4caf50·#d9534f·#4a90d9)이 없다", () => {
    const src = readFileSync(resolve(__dirname, "../../src/lib/art/town.ts"), "utf8").toLowerCase();
    for (const c of ["#4caf50", "#d9534f", "#4a90d9"]) expect(src).not.toContain(c);
  });
  it("계절마다 숲 나무와 벚나무 색이 다르다, 가을에는 단풍·은행·감나무", () => {
    const seasons = ["spring", "summer", "autumn", "winter"] as const;
    const forest = seasons.map((season) =>
      JSON.stringify(
        townLayout([], true, false, false, undefined, { season })
          .structures.filter((s) => s.id.startsWith("tree:"))
          .map((s) => s.art),
      ),
    );
    expect(new Set(forest).size).toBe(4);
    expect(new Set(seasons.map((season) => JSON.stringify(cherryTreeArt(season)))).size).toBe(4);
    expect(cherryTreeArt().palette.L).toBe("#ffb7c5");
    const autumn = townLayout([], true, false, false, undefined, { season: "autumn" }).structures.filter((s) => s.id.startsWith("tree:"));
    const leaves = new Set(autumn.map((t) => t.art.palette.L));
    expect(leaves).toContain("#d9692e");
    expect(leaves).toContain("#e9b341");
    expect(autumn.some((t) => t.art.palette.O === "#e8762c")).toBe(true);
  });
  it("겨울에는 지붕·울타리에 눈 (칸 크기는 그대로)", () => {
    const winter = townLayout([house(0, true)], true, false, false, undefined, { season: "winter" }).structures;
    const summer = townLayout([house(0, true)], true).structures;
    const roof = winter.find((s) => s.id === "house:0")!.art;
    expect(roof.rows.join("")).toContain("Z");
    expect(roof.rows.map((r) => r.length)).toEqual(summer.find((s) => s.id === "house:0")!.art.rows.map((r) => r.length));
    expect(winter.find((s) => s.id.startsWith("fence:"))!.art.rows.join("")).toContain("Z");
    expect(summer.find((s) => s.id === "house:0")!.art.rows.join("")).not.toContain("Z");
  });
});
