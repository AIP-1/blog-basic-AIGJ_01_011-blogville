// 마을에 놓을 것과 입구 (TOWN-03·04, specs/038-town). 그림은 `src/lib/art/town.ts`, 좌표는 `layout.ts`.
import type { PixelArt } from "@/lib/art/characters";
import { benchArt, boardArt, cherryTreeArt, clothesShopArt, emptyLotArt, farmArt, fenceArt, fencePostArt, flowerBedArt, pondArt, fountainArt, houseArt, lampArt, mailboxArt, rosesArchArt, salonArt, shopArt, TOWN_CELL, treeArt } from "@/lib/art/town";
import {
  BOARD_POS,
  CENTER,
  CLOTHES_POS,
  FOUNTAIN_POS,
  GARDEN,
  GARDEN_GATE,
  HILL_ROAD,
  HOUSE_LOTS,
  HOUSE_REACH,
  lotFront,
  PLAZA_RADIUS,
  ROADS,
  SALON_POS,
  FARM_POS,
  POND_POS,
  SHOP_POS,
  START_POS,
  WORLD,
  overlaps,
  shortName,
  type Entrance,
  type Rect,
} from "./layout";
import { CLIFF_FACE, CLIFF_LINES, TERRAIN_WALLS } from "./terrain";

export type TownHouseInput = {
  lot: number;
  slug: string;
  nickname: string;
  blogTitle: string;
  stage: number;
  roof: string;
  mine: boolean;
  /** 집 주인의 입은 모습 (걸어 다니는 이웃, TOWN-19). 없으면 회색 주민 */
  layers?: string[];
  /** 최근 24시간 안에 공개 글을 썼다 (불 켜진 창·굴뚝 연기, 광장 개편) */
  fresh?: boolean;
};

/** 마을에 서는 것 하나: 그림(발밑 기준), 부딪히는 몸체, 이름표 */
export type Structure = {
  id: string;
  art: PixelArt;
  x: number;
  y: number;
  body: Rect | null;
  label?: string;
  sub?: string;
};

/** 들어갈 곳. `href`가 `login`이면 로그인이 필요한 곳(방문자), `mailbox:{자리}`면 우체통 창 (TOWN-13), `lots:{자리}`면 자리 고르기 창 (TOWN-18) */
export type TownEntrance = Entrance & { label: string; href: string };

/** 우체통 입구의 집 자리 번호 (우체통이 아니면 null) */
export function mailboxLot(href: string): number | null {
  const m = /^mailbox:(\d+)$/.exec(href);
  return m ? Number(m[1]) : null;
}

/** 빈 집터 입구의 자리 번호 (자리 고르기가 아니면 null, TOWN-18) */
export function lotChoice(href: string): number | null {
  const m = /^lots:(\d+)$/.exec(href);
  return m ? Number(m[1]) : null;
}

/** 우체통은 집 오른쪽 앞 (집 발밑에서) */
export const MAILBOX_OFFSET = { x: 118, y: 6 } as const;

/**
 * 내 정원 (TOWN-20): 북쪽 흰 울타리(가운데 장미 아치 문), 서쪽·동쪽 울타리 말뚝, 꽃밭 셋, 뒤쪽 귀퉁이 벚나무 둘.
 * 남쪽은 절벽이라 울타리가 없다. 몸체는 빈틈없이 이어져 아치 문으로만 들어간다.
 */
export function gardenStructures(name: string): Structure[] {
  const out: Structure[] = [];
  const fence = fenceArt();
  const post = fencePostArt();
  const top = GARDEN.y;
  const gateLeft = GARDEN_GATE.x - GARDEN_GATE.width / 2;
  const gateRight = GARDEN_GATE.x + GARDEN_GATE.width / 2;
  for (const [a, b] of [
    [GARDEN.x, gateLeft + 10],
    [gateRight - 10, GARDEN.x + GARDEN.width],
  ]) {
    for (let cx = a + 20; cx - 20 < b; cx += 40) {
      const x = Math.min(cx, b - 20);
      out.push({ id: `fence:${x}`, art: fence, x, y: top, body: { x: x - 20, y: top - 8, width: 40, height: 8 } });
    }
  }
  for (const x of [GARDEN.x, GARDEN.x + GARDEN.width]) {
    for (let y = top + 20; y <= GARDEN.y + GARDEN.height; y += 20) {
      out.push({ id: `fence:${x},${y}`, art: post, x, y, body: { x: x - 4, y: y - 20, width: 8, height: 20 } });
    }
  }
  out.push({
    id: "garden-arch",
    art: rosesArchArt(),
    x: GARDEN_GATE.x,
    y: top,
    // 기둥은 양옆 울타리 몸체가 막는다 (문 사이 80px)
    body: null,
    label: name,
  });
  [
    [GARDEN_GATE.x - 95, top + 60],
    [GARDEN_GATE.x + 95, top + 60],
    [GARDEN.x + 100, 1270],
  ].forEach(([x, y], i) => out.push({ id: `flowerbed:${i}`, art: flowerBedArt(i), x, y, body: { x: x - 30, y: y - 20, width: 60, height: 20 } }));
  const cherry = cherryTreeArt();
  for (const [x, y] of [
    [GARDEN.x + 45, top + 75],
    [GARDEN.x + GARDEN.width - 40, top + 80],
  ])
    out.push({ id: `cherry:${x}`, art: cherry, x, y, body: { x: x - 10, y: y - 10, width: 20, height: 10 } });
  return out;
}

/** `walls`: 걸을 수 없는 땅 (절벽 앞면·하늘, TOWN-05) */
export type TownLayout = { structures: Structure[]; entrances: TownEntrance[]; walls: readonly Rect[] };

/** 그림 크기 (px) */
export function artSize(art: PixelArt): { width: number; height: number } {
  return {
    width: art.rows[0].length * TOWN_CELL,
    height: art.rows.length * TOWN_CELL,
  };
}

/** 그림 맨 위 빈 줄을 뺀 실제 높이 (px). 이름표를 그림 바로 위에 붙인다 */
export function artVisibleHeight(art: PixelArt): number {
  const first = art.rows.findIndex((row) => /[^.]/.test(row));
  return (art.rows.length - Math.max(0, first)) * TOWN_CELL;
}

/** 고정 씨앗 난수 (나무 자리가 매번 같다) */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 입구에 붙는 안내: `🏪 상점 · Space 들어가기`, 방문자가 회원 전용 곳에 가면 `· Space 로그인하고 이용하기` */
export function entrancePrompt(e: TownEntrance): string {
  const action = e.href === "login" ? "로그인하고 이용하기" : mailboxLot(e.href) !== null ? "소식 보기" : lotChoice(e.href) !== null ? "이웃 자리 고르기" : "들어가기";
  return `${e.label} · Space ${action}`;
}

/**
 * 마을 배치를 만든다: 게시판(마을 소식·출석 체크 입구 둘)·상점·분수·가로등, 집 자리 11곳(집이 없으면 빈 집터), 나무.
 * 방문자(`member = false`)에게 출석 체크·상점은 로그인 안내다. 집마다 오른쪽 앞에 우체통(TOWN-13), 내 우체통은 안 읽은 알림이 있으면(`mailFlag`) 깃발을 올린다.
 * 내 마을(`chooseLots`)이면 1~10번 빈 집터 앞이 자리 고르기 입구다 (TOWN-18).
 */
export function townLayout(houses: readonly TownHouseInput[], member: boolean, mailFlag = false, chooseLots = false): TownLayout {
  const lotArt = emptyLotArt();
  const lamp = lampArt();
  const structures: Structure[] = [];
  const entrances: TownEntrance[] = [];

  structures.push({
    id: "board",
    art: boardArt(),
    x: BOARD_POS.x,
    y: BOARD_POS.y,
    body: { x: BOARD_POS.x - 120, y: BOARD_POS.y - 40, width: 240, height: 40 },
    label: "마을 게시판",
  });
  entrances.push({
    id: "feed",
    x: BOARD_POS.x - 60,
    y: BOARD_POS.y + 30,
    label: "📋 마을 소식",
    href: "/feed",
  });
  entrances.push({
    id: "attendance",
    x: BOARD_POS.x + 60,
    y: BOARD_POS.y + 30,
    label: "📮 출석 체크",
    href: member ? "/attendance" : "login",
  });

  structures.push({
    id: "shop",
    art: shopArt(),
    x: SHOP_POS.x,
    y: SHOP_POS.y,
    body: { x: SHOP_POS.x - 95, y: SHOP_POS.y - 60, width: 190, height: 60 },
    label: "상점",
  });
  entrances.push({
    id: "shop",
    x: SHOP_POS.x + 40,
    y: SHOP_POS.y + 30,
    label: "🏪 상점",
    href: member ? "/shop" : "login",
  });

  // 광장 가게 (SHOP-07·08)
  for (const shop of [
    { id: "clothes", art: clothesShopArt(), pos: CLOTHES_POS, label: "꼬까 옷가게", entrance: "👗 옷가게", href: "/clothes" },
    { id: "salon", art: salonArt(), pos: SALON_POS, label: "반짝 미용실", entrance: "💇 미용실", href: "/salon" },
  ]) {
    structures.push({ id: shop.id, art: shop.art, x: shop.pos.x, y: shop.pos.y, body: { x: shop.pos.x - 70, y: shop.pos.y - 50, width: 140, height: 50 }, label: shop.label });
    entrances.push({ id: shop.id, x: shop.pos.x + 30, y: shop.pos.y + 30, label: shop.entrance, href: member ? shop.href : "login" });
  }

  structures.push({
    id: "farm",
    art: farmArt(),
    x: FARM_POS.x,
    y: FARM_POS.y,
    body: { x: FARM_POS.x - 110, y: FARM_POS.y - 50, width: 220, height: 50 },
    label: "동물 농장",
  });
  entrances.push({
    id: "farm",
    x: FARM_POS.x,
    y: FARM_POS.y + 30,
    label: "🐮 동물 농장",
    href: member ? "/farm" : "login",
  });

  const owner = houses.find((h) => h.lot === 0);
  structures.push(...gardenStructures(owner && !owner.mine ? `${shortName(owner.nickname)}의 정원` : "내 정원"));

  structures.push({
    id: "pond",
    art: pondArt(),
    x: POND_POS.x,
    y: POND_POS.y,
    body: { x: POND_POS.x - 100, y: POND_POS.y - 110, width: 200, height: 70 },
    label: "연못 낚시터",
  });
  entrances.push({
    id: "pond",
    x: POND_POS.x,
    y: POND_POS.y + 30,
    label: "🎣 낚시터",
    href: member ? "/fishing" : "login",
  });

  structures.push({
    id: "fountain",
    art: fountainArt(),
    x: FOUNTAIN_POS.x,
    y: FOUNTAIN_POS.y,
    body: {
      x: FOUNTAIN_POS.x - 70,
      y: FOUNTAIN_POS.y - 45,
      width: 140,
      height: 45,
    },
  });
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const x = CENTER.x + dx * (PLAZA_RADIUS - 30) * 0.72;
    const y = CENTER.y + dy * (PLAZA_RADIUS - 30) * 0.72;
    structures.push({
      id: `lamp:${dx},${dy}`,
      art: lamp,
      x,
      y,
      body: { x: x - 6, y: y - 8, width: 12, height: 8 },
    });
  }

  // 북쪽 언덕 위 전망대 의자 (TOWN-05): 언덕 길 바로 위
  structures.push({
    id: "lookout",
    art: benchArt(),
    x: CENTER.x,
    y: HILL_ROAD - 32,
    body: { x: CENTER.x - 40, y: HILL_ROAD - 44, width: 80, height: 12 },
    label: "전망대",
  });

  HOUSE_LOTS.forEach((lot, i) => {
    const house = houses.find((h) => h.lot === i);
    if (house) {
      const name = house.mine ? "내 집" : `${shortName(house.nickname)}의 집`;
      const body = { x: lot.x - 55, y: lot.y - 55, width: 105, height: 55 };
      structures.push({
        id: `house:${i}`,
        art: houseArt(house.stage, house.roof),
        x: lot.x,
        y: lot.y,
        body,
        label: name,
        sub: house.blogTitle,
      });
      const front = lotFront(i);
      entrances.push({
        id: `house:${i}`,
        x: front.x,
        y: front.y,
        label: `🏠 ${name}`,
        href: `/@${house.slug}`,
        // 앞문까지 돌아가지 않아도 집 옆·뒤 가까이에서 들어간다
        around: { x: body.x - HOUSE_REACH, y: body.y - HOUSE_REACH, width: body.width + HOUSE_REACH * 2, height: body.height + HOUSE_REACH * 2 },
      });
      const box = { x: lot.x + MAILBOX_OFFSET.x, y: lot.y + MAILBOX_OFFSET.y };
      structures.push({
        id: `mailbox:${i}`,
        art: mailboxArt(house.mine, house.mine && mailFlag),
        x: box.x,
        y: box.y,
        body: { x: box.x - 8, y: box.y - 8, width: 16, height: 8 },
      });
      entrances.push({
        id: `mailbox:${i}`,
        x: box.x,
        y: box.y + 34,
        label: house.mine ? "📬 내 우체통" : `📬 ${shortName(house.nickname)}의 우체통`,
        href: `mailbox:${i}`,
      });
    } else {
      structures.push({
        id: `lot:${i}`,
        art: lotArt,
        x: lot.x,
        y: lot.y + 10,
        body: null,
        label: i === 0 ? "내 집 자리" : "빈 집터",
      });
      if (chooseLots && i > 0) {
        const front = lotFront(i);
        entrances.push({ id: `lot:${i}`, x: front.x, y: front.y, label: `🏡 빈 집터 ${i}번`, href: `lots:${i}` });
      }
    }
  });

  // 나무: 마을 가장자리 숲 + 군데군데. 길·광장·건물 근처는 비운다
  const random = seeded(20261012);
  const keepOut: Rect[] = [
    ...ROADS.map((r) => ({
      x: r.x - 20,
      y: r.y - 40,
      width: r.width + 40,
      height: r.height + 80,
    })),
    // 절벽 앞면과 그 위아래 가장자리
    ...CLIFF_LINES.map((line) => ({ x: 0, y: line - 24, width: WORLD.width, height: CLIFF_FACE + 48 })),
    // 내 정원 (TOWN-20): 숲 나무가 울타리 안팎에 붙지 않게
    { x: GARDEN.x - 40, y: GARDEN.y - 40, width: GARDEN.width + 80, height: GARDEN.height + 40 },
    {
      x: CENTER.x - PLAZA_RADIUS - 30,
      y: CENTER.y - PLAZA_RADIUS - 30,
      width: (PLAZA_RADIUS + 30) * 2,
      height: (PLAZA_RADIUS + 30) * 2,
    },
    ...structures.map((s) => {
      const { width, height } = artSize(s.art);
      return {
        x: s.x - width / 2 - 30,
        y: s.y - height - 10,
        width: width + 60,
        height: height + 110,
      };
    }),
  ];
  const treeArts = [treeArt(0), treeArt(1)];
  const trees: Structure[] = [];
  for (let tries = 0; tries < 900 && trees.length < 140; tries++) {
    const edge = tries % 3 !== 0;
    let x = random() * WORLD.width;
    let y = 60 + random() * (WORLD.height - 60);
    if (edge) {
      // 가장자리 띠 (120px)
      const side = Math.floor(random() * 4);
      if (side === 0) x = random() * 120;
      else if (side === 1) x = WORLD.width - random() * 120;
      else if (side === 2) y = 80 + random() * 120;
      else y = WORLD.height - random() * 60;
    }
    const spot = { x: x - 30, y: y - 20, width: 60, height: 24 };
    if (keepOut.some((k) => overlaps(spot, k)) || trees.some((t) => Math.hypot(t.x - x, t.y - y) < 46)) continue;
    trees.push({
      id: `tree:${trees.length}`,
      art: treeArts[trees.length % 2],
      x,
      y,
      body: { x: x - 10, y: y - 10, width: 20, height: 10 },
    });
  }
  structures.push(...trees);
  return { structures, entrances, walls: TERRAIN_WALLS };
}

/** ✨ 텔레포트 한 줄 (TOWN-12): 고르면 그 앞(`x`, `y`)으로. 빈 집터는 고를 수 없다 */
export type TownSpot = { id: string; label: string; sub: string | null; x: number; y: number; enabled: boolean; slug: string | null };

export const EMPTY_LOT_HINT = "친구 목록에서 ⭐를 누르면 집이 생겨요";

/**
 * 텔레포트 목록: `마을` 7곳(분수·게시판·상점·옷가게·미용실·농장·낚시터) + 집 11자리. 게임과 같은 좌표(입구 앞)를 쓴다.
 * 빈 집터의 부제(⭐ 안내)는 회원에게만, 0번 자리는 없다.
 */
export function townSpots(houses: readonly TownHouseInput[], member: boolean): { places: TownSpot[]; houses: TownSpot[] } {
  const places: TownSpot[] = [
    { id: "fountain", label: "⛲ 광장 분수", sub: null, ...START_POS, enabled: true, slug: null },
    { id: "board", label: "📋 마을 게시판", sub: null, x: BOARD_POS.x, y: BOARD_POS.y + 30, enabled: true, slug: null },
    { id: "shop", label: "🏪 상점", sub: null, x: SHOP_POS.x + 40, y: SHOP_POS.y + 30, enabled: true, slug: null },
    { id: "clothes", label: "👗 옷가게", sub: null, x: CLOTHES_POS.x + 30, y: CLOTHES_POS.y + 30, enabled: true, slug: null },
    { id: "salon", label: "💇 미용실", sub: null, x: SALON_POS.x + 30, y: SALON_POS.y + 30, enabled: true, slug: null },
    { id: "farm", label: "🐮 동물 농장", sub: null, x: FARM_POS.x, y: FARM_POS.y + 30, enabled: true, slug: null },
    { id: "pond", label: "🎣 낚시터", sub: null, x: POND_POS.x, y: POND_POS.y + 30, enabled: true, slug: null },
  ];
  const lots = HOUSE_LOTS.map((_, i): TownSpot => {
    const house = houses.find((h) => h.lot === i);
    const front = lotFront(i);
    if (house) return { id: `house:${i}`, label: house.mine ? "🏠 내 집" : `🏠 ${shortName(house.nickname)}의 집`, sub: house.blogTitle, ...front, enabled: true, slug: house.slug };
    return { id: `lot:${i}`, label: i === 0 ? "내 집 자리" : "빈 집터", sub: i === 0 || !member ? null : EMPTY_LOT_HINT, ...front, enabled: false, slug: null };
  });
  return { places, houses: lots };
}
