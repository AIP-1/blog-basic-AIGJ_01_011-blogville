// 마을에 놓을 것과 입구 (TOWN-03·04, specs/038-town). 그림은 `src/lib/art/town.ts`, 좌표는 `layout.ts`.
import type { PixelArt } from "@/lib/art/characters";
import {
  benchArt,
  boardArt,
  cherryTreeArt,
  clothesShopArt,
  emptyLotArt,
  farmArt,
  fenceArt,
  fencePostArt,
  flowerBedArt,
  FOUNTAIN_FRAMES,
  fountainArt,
  ghostHouseArt,
  houseArt,
  lampArt,
  lanternArt,
  litHouseArt,
  mailboxArt,
  mastArt,
  persimmonTreeArt,
  POND_FRAMES,
  pondArt,
  rosesArchArt,
  salonArt,
  shopArt,
  snowCap,
  TOWN_CELL,
  treeArt,
  withEaveLantern,
} from "@/lib/art/town";
import { todayKST } from "@/lib/kst";
import { ROOF_CODES, ROOF_HEX } from "@/lib/roof";
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
  type Point,
  type Rect,
} from "./layout";
import type { Season } from "./season";
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
  /** 가장 최근 공개 글 제목: 글 쓴 이웃이 가까이 오면 머리 위 말풍선 (광장 개편) */
  latestTitle?: string;
  /** 우체통 최근 글 (최신순): 말풍선·초롱을 누르면 맨 앞 글로 간다 (광장 개편 2) */
  recentPosts?: readonly { id: number; title: string; createdAt: string }[];
  /** 이사 올 이웃의 흐린 집: 걷는 이웃·초롱·말풍선이 없고, 들어가면 우체통 창 (광장 개편 2, B1) */
  suggested?: boolean;
  /** 내가 아직 안 읽은 새 글이 있다: 우체통 깃발·말풍선은 이것을 따른다. 없으면 `fresh` (광장 개편 2, B4) */
  unread?: boolean;
};

/** 우체통 깃발·말풍선을 올릴 새 글: 안 읽은 글(`unread`), 모르면 24시간 안에 쓴 글(`fresh`) */
export function hasNews(h: Pick<TownHouseInput, "unread" | "fresh">): boolean {
  return h.unread ?? h.fresh === true;
}

/** 이름표 모양 (광장 개편): `sign` 늘 보이는 나무 간판(건물), `plate` 가까이 가면 보이는 집 문패, `lot` 빈 집터 팻말 */
export type TagKind = "sign" | "plate" | "lot";

/** 마을에 서는 것 하나: 그림(발밑 기준), 부딪히는 몸체, 이름표 */
export type Structure = {
  id: string;
  art: PixelArt;
  x: number;
  y: number;
  body: Rect | null;
  label?: string;
  sub?: string;
  /** 이름표 모양 (`label`이 있을 때) */
  tag?: TagKind;
  /** 움직이는 그림 (분수 물 3장·연못 2장): 0번이 `art`이고 모두 크기가 같다 */
  frames?: readonly PixelArt[];
  /** 글 쓴 집: 불 켜진 창과 굴뚝 연기 */
  lit?: boolean;
  /** 반투명으로 그린다 (이사 올 이웃의 흐린 집, 0~1) */
  alpha?: number;
};

/** 게시판 쪽지·도장 수 (살아 있는 게시판). 기본 (3, 3)은 예전 그림 */
export type BoardState = { papers: number; stamps: number };

/** 숲 나무는 발밑이 이 y보다 아래여야 한다 (위는 먼 하늘·산 띠라 나무가 하늘에 뜬다) */
export const TREE_MIN_Y = 110;

/** 들어갈 곳. `href`가 `login`이면 로그인이 필요한 곳(방문자), `mailbox:{자리}`면 우체통 창 (TOWN-13), `lots:{자리}`면 자리 고르기 창 (TOWN-18) */
export type TownEntrance = Entrance & {
  label: string;
  href: string;
  /** 안내 끝의 동작 이름 (`· Space {action}`). 없으면 href로 정한다 */
  action?: string;
  /** 안내 말풍선을 띄울 자리 (공중에 매달린 초롱처럼 입구와 그림이 떨어져 있을 때) */
  anchor?: { x: number; y: number };
};

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
export function gardenStructures(name: string, season: Season = "spring"): Structure[] {
  const out: Structure[] = [];
  const winter = season === "winter";
  const fence = winter ? snowCap(fenceArt()) : fenceArt();
  const post = winter ? snowCap(fencePostArt()) : fencePostArt();
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
    tag: "sign",
  });
  [
    [GARDEN_GATE.x - 95, top + 60],
    [GARDEN_GATE.x + 95, top + 60],
    [GARDEN.x + 100, 1270],
  ].forEach(([x, y], i) => out.push({ id: `flowerbed:${i}`, art: flowerBedArt(i), x, y, body: { x: x - 30, y: y - 20, width: 60, height: 20 } }));
  const cherry = cherryTreeArt(season);
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

/**
 * 점(세계 px)이 그 그림의 칠한 칸 위인가. 그림 상자 안이라도 빈 칸(`.`)은 풀밭이라 치지 않는다 (집 그림 양옆·지붕 위는 풀밭).
 * `tolerance`칸 둘레까지 봐 준다 (그림 가장자리를 살짝 비껴 눌러도)
 */
export function onArt(s: Pick<Structure, "art" | "x" | "y">, p: { x: number; y: number }, tolerance = 1): boolean {
  const { width, height } = artSize(s.art);
  const cx = Math.floor((p.x - (s.x - width / 2)) / TOWN_CELL);
  const cy = Math.floor((p.y - (s.y - height)) / TOWN_CELL);
  for (let dy = -tolerance; dy <= tolerance; dy++) {
    const row = s.art.rows[cy + dy];
    if (!row) continue;
    for (let dx = -tolerance; dx <= tolerance; dx++) {
      const ch = row[cx + dx];
      if (ch !== undefined && ch !== "." && s.art.palette[ch]) return true;
    }
  }
  return false;
}

/** 그 점에 그려진 것 가운데 맨 앞(아랫변이 가장 아래, 나중에 그린 것) */
export function structureAt<T extends Pick<Structure, "art" | "x" | "y">>(structures: readonly T[], p: { x: number; y: number }): T | undefined {
  let best: T | undefined;
  for (const s of structures) if ((!best || s.y >= best.y) && onArt(s, p)) best = s;
  return best;
}

/**
 * 입구의 이름표를 단 건물·집 (입구 안내 말풍선을 그 이름표 자리에 띄우고 이름표는 쉰다). 게시판의 두 입구(마을 소식·출석)는 게시판.
 * 빈 집터 팻말(`lot`)과 이름표가 없는 우체통은 없음: 안내는 입구 위에 뜬다.
 */
export function entranceOwner<T extends Pick<Structure, "id" | "label" | "tag">>(e: { id: string }, structures: readonly T[]): T | undefined {
  const id = BOARD_DOORS.some((d) => d.id === e.id) ? "board" : e.id;
  return structures.find((s) => s.id === id && s.label !== undefined && s.tag !== "lot");
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
  const action = e.action ?? (e.href === "login" ? "로그인하고 이용하기" : mailboxLot(e.href) !== null ? "소식 보기" : lotChoice(e.href) !== null ? "이웃 자리 고르기" : "들어가기");
  return `${e.label} · Space ${action}`;
}

/** 게시판 아래 세 입구 (게시판 가운데에서 x만큼): 마을 소식·이번 주 글감·출석 체크. 팻말은 판 아래 다리 사이에 매달린다 */
export const BOARD_DOORS = [
  { id: "feed", dx: -65, plank: "소식" },
  { id: "prompt", dx: 0, plank: "글감" },
  { id: "attendance", dx: 65, plank: "출석" },
] as const;
/** 게시판 팻말이 매달린 높이 (게시판 발밑에서 위로) */
export const BOARD_PLANK_LIFT = 24;

/**
 * 분수 몸체 (광장 개편 2): 둥근 수반에 맞춘 3단 상자 (가운데가 넓고 위아래 끝이 좁다).
 * 키보드로 밀면 계단 모서리처럼 옆으로 미끄러져(`path.ts` `slideStep`) 분수를 돌아간다.
 */
export const FOUNTAIN_BODIES: readonly Rect[] = [
  { x: FOUNTAIN_POS.x - 45, y: FOUNTAIN_POS.y - 45, width: 90, height: 8 },
  { x: FOUNTAIN_POS.x - 70, y: FOUNTAIN_POS.y - 37, width: 140, height: 29 },
  { x: FOUNTAIN_POS.x - 45, y: FOUNTAIN_POS.y - 8, width: 90, height: 8 },
];

/** 광장 가로등 네 자리 (발밑): 북서·북동·남서·남동 */
export const LAMP_POS: readonly Point[] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
].map(([dx, dy]) => ({ x: CENTER.x + dx * (PLAZA_RADIUS - 30) * 0.72, y: CENTER.y + dy * (PLAZA_RADIUS - 30) * 0.72 }));

/** 줄등 장대 (발밑은 분수 몸체 안, 수반 뒤쪽): 꼭대기 가로대에 줄 네 가닥을 묶는다 */
export const MAST_POS = { x: FOUNTAIN_POS.x, y: FOUNTAIN_POS.y - 42 } as const;
/** 가로등 그림 높이 (6×22칸) */
const LAMP_HEIGHT = 22 * TOWN_CELL;
/** 줄이 가운데에서 처지는 깊이 (px) */
export const ROPE_SAG = 24;
/** 줄등 초롱은 이만큼까지 (즐겨찾는 이웃 lot 순서) */
export const LANTERN_MAX = 10;

/** 줄 네 가닥: 가로등 꼭대기에서 장대 가로대 끝까지 (줄 순서 북서·북동·남동·남서, 시계 방향) */
export function lanternRopes(): { from: Point; to: Point }[] {
  const mast = artSize(mastArt());
  const bar = MAST_POS.y - mast.height + 2.5 * TOWN_CELL;
  const order = [0, 1, 3, 2];
  return order.map((i) => {
    const lamp = LAMP_POS[i];
    const side = lamp.x < MAST_POS.x ? -1 : 1;
    return { from: { x: lamp.x, y: lamp.y - LAMP_HEIGHT }, to: { x: MAST_POS.x + side * 2 * TOWN_CELL, y: bar } };
  });
}

/** 줄 위의 점 (`t` 0 가로등 ~ 1 장대): 가운데가 `ROPE_SAG`만큼 처진 곡선 */
export function ropePoint(rope: { from: Point; to: Point }, t: number): Point {
  return {
    x: rope.from.x + (rope.to.x - rope.from.x) * t,
    y: rope.from.y + (rope.to.y - rope.from.y) * t + ROPE_SAG * 4 * t * (1 - t),
  };
}

/** 줄등 초롱 하나: 그 이웃의 집 자리, 켜짐(24시간 안 글), 밝기(최근일수록), 맨 앞 글 */
export type LanternSlot = {
  lot: number;
  slug: string;
  nickname: string;
  lit: boolean;
  /** 켜진 초롱의 빛 세기: 0~8시간 1, 8~16시간 0.7, 16~24시간 0.4. 꺼지면 0 */
  brightness: number;
  post: { id: number; title: string } | null;
};

/** 글을 쓴 지 몇 시간 됐는지로 초롱 밝기 (24시간이 지났으면 0) */
export function lanternBrightness(createdAt: string | undefined, now = new Date()): number {
  if (!createdAt) return 0;
  const hours = (now.getTime() - Date.parse(createdAt)) / 3_600_000;
  if (!(hours < 24)) return 0;
  return hours < 8 ? 1 : hours < 16 ? 0.7 : 0.4;
}

/**
 * 줄등에 달 초롱 (광장 개편 2 대표 장면): 즐겨찾는 이웃(1~10번 자리, 내 집·이사 올 집 빼고) 한 명에 하나, lot 순서로 10개까지.
 * 24시간 안에 공개 글을 쓴 이웃(`fresh`)만 켜진다. 밝기는 맨 앞 글이 최근일수록 세다.
 */
export function lanternSlots(houses: readonly TownHouseInput[], now = new Date()): LanternSlot[] {
  return houses
    .filter((h) => h.lot > 0 && !h.mine && !h.suggested)
    .sort((a, b) => a.lot - b.lot)
    .slice(0, LANTERN_MAX)
    .map((h) => {
      const latest = h.recentPosts?.[0];
      const lit = h.fresh === true;
      const brightness = lit ? lanternBrightness(latest?.createdAt, now) || 1 : 0;
      return { lot: h.lot, slug: h.slug, nickname: h.nickname, lit, brightness, post: latest ? { id: latest.id, title: latest.title } : null };
    });
}

/** 초롱이 매달린 자리 (`lanternSlots` 순서): 줄 번호, 줄 위 `t`, 매다는 점(초롱 맨 윗줄 가운데) */
export function lanternPlacements(count: number): { rope: number; t: number; hook: Point }[] {
  const ropes = lanternRopes();
  const perRope = ropes.map((_, r) => Math.floor(count / ropes.length) + (r < count % ropes.length ? 1 : 0));
  return Array.from({ length: Math.min(count, LANTERN_MAX) }, (_, i) => {
    const rope = i % ropes.length;
    const j = Math.floor(i / ropes.length);
    const t = (j + 1) / (perRope[rope] + 1);
    const p = ropePoint(ropes[rope], t);
    return { rope, t, hook: { x: Math.round(p.x), y: Math.round(p.y) } };
  });
}

/** 초롱 아랫변에서 이만큼 아래(발밑, px)가 그 초롱 앞이다: 초롱 바로 밑에 머리를 두고 선 자리 */
export const LANTERN_STAND = 20;

/** 그날의 지붕색 (방문자 마을의 '여기에 내 집 짓기' 자리): 한국 날짜마다 바뀐다 */
export function dayRoof(now = new Date()): string {
  const day = todayKST(now);
  let h = 0;
  for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ROOF_HEX[ROOF_CODES[h % ROOF_CODES.length]];
}

/** 방문자 마을 0번 자리 입구 (가입 안내) */
export const GUEST_HOME_LABEL = "🏡 여기에 내 집 짓기";

/** `townLayout` 선택 값: 계절(그림 팔레트), 지금 시각(초롱 밝기·그날 지붕), 0번 자리 주인이 오늘 글을 썼는지(장대 꼭대기 초롱) */
export type LayoutOptions = { season?: Season; now?: Date; homePosted?: boolean };

/**
 * 마을 배치를 만든다: 게시판(마을 소식·이번 주 글감·출석 체크 입구 셋)·상점·분수·줄등·가로등, 집 자리 11곳(집이 없으면 빈 집터), 나무.
 * 방문자(`member = false`)에게 출석 체크·상점은 로그인 안내이고, 0번 자리에 흐린 집과 '여기에 내 집 짓기' 입구가 선다.
 * 집마다 오른쪽 앞에 우체통(TOWN-13), 내 우체통은 안 읽은 알림이 있으면(`mailFlag`) 깃발을 올린다.
 * 내 마을(`chooseLots`)이면 1~10번 빈 집터 앞이 자리 고르기 입구다 (TOWN-18). 이사 올 이웃(`suggested`)은 흐린 집이고 들어가면 우체통 창.
 * 24시간 안에 글을 쓴 집(`fresh`)은 창에 불이 켜지고 처마 끝에 초롱이 달린다. 이웃 우체통 깃발은 안 읽은 새 글(`hasNews`).
 * 친구 마을(0번 자리가 남의 집)이면 동물 농장 입구는 그 집 농장 구경(`/farm?host=`)이고 게임 방들은 `?host=`를 이어 받는다.
 */
export function townLayout(
  houses: readonly TownHouseInput[],
  member: boolean,
  mailFlag = false,
  chooseLots = false,
  board: BoardState = { papers: 3, stamps: 3 },
  options: LayoutOptions = {},
): TownLayout {
  const season = options.season ?? "summer";
  const now = options.now ?? new Date();
  const winter = season === "winter";
  const snowy = (a: PixelArt, only?: string) => (winter ? snowCap(a, only) : a);
  const lotArt = emptyLotArt();
  const lamp = lampArt();
  const structures: Structure[] = [];
  const entrances: TownEntrance[] = [];
  const owner = houses.find((h) => h.lot === 0);
  // 친구 마을: 0번 자리가 남의 집. 게임 방은 그 마을로 돌아오게 주인 주소를 이어 준다 (C4)
  const host = member && owner && !owner.mine ? owner.slug : null;
  const room = (href: string) => (host ? `${href}?host=${encodeURIComponent(host)}` : href);

  structures.push({
    id: "board",
    art: snowy(boardArt(board.papers, board.stamps)),
    x: BOARD_POS.x,
    y: BOARD_POS.y,
    body: { x: BOARD_POS.x - 120, y: BOARD_POS.y - 40, width: 240, height: 40 },
    label: "마을 게시판",
    tag: "sign",
  });
  const boardHref: Record<(typeof BOARD_DOORS)[number]["id"], { label: string; href: string }> = {
    feed: { label: "📋 마을 소식", href: "/feed" },
    prompt: { label: "📝 이번 주 글감", href: "/prompt" },
    attendance: { label: "📮 출석 체크", href: member ? "/attendance" : "login" },
  };
  for (const d of BOARD_DOORS) entrances.push({ id: d.id, x: BOARD_POS.x + d.dx, y: BOARD_POS.y + 30, ...boardHref[d.id] });

  structures.push({
    id: "shop",
    art: snowy(shopArt()),
    x: SHOP_POS.x,
    y: SHOP_POS.y,
    body: { x: SHOP_POS.x - 95, y: SHOP_POS.y - 60, width: 190, height: 60 },
    label: "상점",
    tag: "sign",
  });
  entrances.push({
    id: "shop",
    x: SHOP_POS.x + 40,
    y: SHOP_POS.y + 30,
    label: "🏪 상점",
    href: member ? room("/shop") : "login",
  });

  // 광장 가게 (SHOP-07·08)
  for (const shop of [
    { id: "clothes", art: clothesShopArt(), pos: CLOTHES_POS, label: "꼬까 옷가게", entrance: "👗 옷가게", href: "/clothes" },
    { id: "salon", art: salonArt(), pos: SALON_POS, label: "반짝 미용실", entrance: "💇 미용실", href: "/salon" },
  ]) {
    structures.push({ id: shop.id, art: snowy(shop.art), x: shop.pos.x, y: shop.pos.y, body: { x: shop.pos.x - 70, y: shop.pos.y - 50, width: 140, height: 50 }, label: shop.label, tag: "sign" });
    entrances.push({ id: shop.id, x: shop.pos.x + 30, y: shop.pos.y + 30, label: shop.entrance, href: member ? room(shop.href) : "login" });
  }

  structures.push({
    id: "farm",
    art: snowy(farmArt()),
    x: FARM_POS.x,
    y: FARM_POS.y,
    body: { x: FARM_POS.x - 110, y: FARM_POS.y - 50, width: 220, height: 50 },
    label: "동물 농장",
    tag: "sign",
  });
  entrances.push({
    id: "farm",
    x: FARM_POS.x,
    y: FARM_POS.y + 30,
    label: host ? `🐮 ${shortName(owner!.nickname)}의 농장` : "🐮 동물 농장",
    href: member ? room("/farm") : "login",
    ...(host ? { action: "구경하기" } : {}),
  });

  structures.push(...gardenStructures(owner && !owner.mine ? `${shortName(owner.nickname)}의 정원` : member ? "내 정원" : "빈 정원", season));

  const pond = Array.from({ length: POND_FRAMES }, (_, f) => pondArt(f));
  structures.push({
    id: "pond",
    art: pond[0],
    frames: pond,
    x: POND_POS.x,
    y: POND_POS.y,
    body: { x: POND_POS.x - 100, y: POND_POS.y - 110, width: 200, height: 70 },
    label: "연못 낚시터",
    tag: "sign",
  });
  entrances.push({
    id: "pond",
    x: POND_POS.x,
    y: POND_POS.y + 30,
    label: "🎣 낚시터",
    href: member ? room("/fishing") : "login",
  });

  const fountain = Array.from({ length: FOUNTAIN_FRAMES }, (_, f) => fountainArt(f));
  structures.push({
    id: "fountain",
    art: fountain[0],
    frames: fountain,
    x: FOUNTAIN_POS.x,
    y: FOUNTAIN_POS.y,
    // 몸체는 둥근 3단 상자 (`FOUNTAIN_BODIES`, 걸을 수 없는 땅 `walls`에 든다)
    body: null,
  });
  // 줄등 장대: 분수 몸체 안에 서서 길을 막지 않는다 (몸체 없음)
  structures.push({ id: "mast", art: mastArt(), x: MAST_POS.x, y: MAST_POS.y, body: null });
  for (const p of LAMP_POS) {
    const [dx, dy] = [p.x < CENTER.x ? -1 : 1, p.y < CENTER.y ? -1 : 1];
    structures.push({
      id: `lamp:${dx},${dy}`,
      art: lamp,
      x: p.x,
      y: p.y,
      body: { x: p.x - 6, y: p.y - 8, width: 12, height: 8 },
    });
  }

  // 북쪽 언덕 위 전망대 의자 (TOWN-05): 언덕 길 바로 위
  structures.push({
    id: "lookout",
    art: snowy(benchArt()),
    x: CENTER.x,
    y: HILL_ROAD - 32,
    body: { x: CENTER.x - 40, y: HILL_ROAD - 44, width: 80, height: 12 },
    label: "전망대",
    tag: "sign",
  });

  HOUSE_LOTS.forEach((lot, i) => {
    const house = houses.find((h) => h.lot === i);
    const body = { x: lot.x - 55, y: lot.y - 55, width: 105, height: 55 };
    const front = lotFront(i);
    const around = { x: body.x - HOUSE_REACH, y: body.y - HOUSE_REACH, width: body.width + HOUSE_REACH * 2, height: body.height + HOUSE_REACH * 2 };
    const box = { x: lot.x + MAILBOX_OFFSET.x, y: lot.y + MAILBOX_OFFSET.y };
    const mailboxBody = { x: box.x - 8, y: box.y - 8, width: 16, height: 8 };
    if (house?.suggested) {
      // 이사 올 이웃 (B1): 흐린 집, 들어가면 우체통 창이 이사 버튼을 보인다
      const nick = shortName(house.nickname);
      structures.push({ id: `house:${i}`, art: ghostHouseArt(house.stage), x: lot.x, y: lot.y, body, label: `이사 올 집 · ${nick}`, sub: house.blogTitle, tag: "plate", alpha: 0.55 });
      structures.push({ id: `mailbox:${i}`, art: mailboxArt(false, false), x: box.x, y: box.y, body: mailboxBody, alpha: 0.55 });
      entrances.push({ id: `house:${i}`, x: front.x, y: front.y, label: `🏡 ${nick}님이 이사 올 수 있어요`, href: `mailbox:${i}`, action: "구경하기", around });
    } else if (house) {
      const name = house.mine ? "내 집" : `${shortName(house.nickname)}의 집`;
      const art = snowy(houseArt(house.stage, house.roof), "RrCc");
      structures.push({
        id: `house:${i}`,
        art: house.fresh ? withEaveLantern(litHouseArt(art)) : art,
        x: lot.x,
        y: lot.y,
        body,
        label: name,
        sub: house.blogTitle,
        tag: "plate",
        ...(house.fresh ? { lit: true } : {}),
      });
      entrances.push({
        id: `house:${i}`,
        x: front.x,
        y: front.y,
        label: `🏠 ${name}`,
        href: `/@${house.slug}`,
        // 앞문까지 돌아가지 않아도 집 옆·뒤 가까이에서 들어간다
        around,
      });
      structures.push({
        id: `mailbox:${i}`,
        // 내 우체통은 안 읽은 알림, 이웃 우체통은 안 읽은 새 글이 있으면 깃발 (B4: 모르면 24시간 안 글)
        art: snowy(mailboxArt(house.mine, house.mine ? mailFlag : hasNews(house))),
        x: box.x,
        y: box.y,
        body: mailboxBody,
      });
      entrances.push({
        id: `mailbox:${i}`,
        x: box.x,
        y: box.y + 34,
        label: house.mine ? "📬 내 우체통" : `📬 ${shortName(house.nickname)}님의 우체통`,
        href: `mailbox:${i}`,
      });
    } else if (i === 0 && !member) {
      // 방문자 마을 (A6): 0번 자리에 그날 지붕색의 흐린 집, 가입하면 여기에 내 집이 선다
      structures.push({ id: "house:0", art: ghostHouseArt(1, dayRoof(now)), x: lot.x, y: lot.y, body, label: "여기에 내 집 짓기", tag: "plate", alpha: 0.55 });
      entrances.push({ id: "house:0", x: front.x, y: front.y, label: GUEST_HOME_LABEL, href: "login", action: "가입하기", around });
    } else {
      structures.push({
        id: `lot:${i}`,
        art: lotArt,
        x: lot.x,
        y: lot.y + 10,
        body: null,
        label: i === 0 ? "내 집 자리" : "빈 집터",
        tag: "lot",
      });
      if (chooseLots && i > 0) {
        entrances.push({ id: `lot:${i}`, x: front.x, y: front.y, label: `🏡 빈 집터 ${i}번`, href: `lots:${i}` });
      }
    }
  });

  // 줄등 초롱 (광장 개편 2): 켜진 초롱 아래에 서면 그 글로 들어간다. 장대 꼭대기는 0번 자리 주인의 초롱
  const slots = lanternSlots(houses, now);
  const places = lanternPlacements(slots.length);
  const lanternHeight = artSize(lanternArt(true, "m")).height;
  slots.forEach((slot, i) => {
    if (!slot.lit || !slot.post) return;
    const { hook } = places[i];
    entrances.push({
      id: `lantern:${slot.lot}`,
      x: hook.x,
      y: hook.y + lanternHeight + LANTERN_STAND,
      label: `🏮 ${shortName(slot.nickname, 6)} · ${shortName(slot.post.title, 14)}`,
      href: `/@${slot.slug}/${slot.post.id}`,
      action: "글 읽기",
      anchor: { x: hook.x, y: hook.y - 6 },
    });
  });
  if (owner && !owner.suggested) {
    const top = mastTop();
    const homeLit = owner.mine ? (options.homePosted ?? owner.fresh === true) : owner.fresh === true;
    const latest = owner.recentPosts?.[0];
    // 장대 꼭대기 초롱은 장대 위에 얹혀 있어 장대 북쪽 발치에 선다
    const stand = { x: top.x, y: top.y + 60 };
    if (owner.mine && !homeLit) entrances.push({ id: "lantern:home", ...stand, label: "🏮 내 초롱", href: "/write", action: "글 쓰고 켜기", anchor: { x: top.x, y: top.y - 6 } });
    else if (homeLit && latest)
      entrances.push({
        id: "lantern:home",
        ...stand,
        label: owner.mine ? "🏮 내 초롱이 켜졌어요" : `🏮 ${shortName(owner.nickname, 6)} · ${shortName(latest.title, 14)}`,
        href: `/@${owner.slug}/${latest.id}`,
        action: "글 읽기",
        anchor: { x: top.x, y: top.y - 6 },
      });
  }

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
  // 계절 (A5): 가을이면 4그루에 하나는 단풍, 하나는 은행, 7그루에 하나는 감나무
  const treeArts = [0, 1, 2, 3].map((v) => treeArt(v, season));
  const persimmon = season === "autumn" ? persimmonTreeArt() : null;
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
    // 하늘·산 띠에 뜬 나무는 심지 않는다 (광장 개편)
    if (y < TREE_MIN_Y) continue;
    const spot = { x: x - 30, y: y - 20, width: 60, height: 24 };
    if (keepOut.some((k) => overlaps(spot, k)) || trees.some((t) => Math.hypot(t.x - x, t.y - y) < 46)) continue;
    const n = trees.length;
    trees.push({
      id: `tree:${n}`,
      art: persimmon && n % 7 === 3 ? persimmon : treeArts[season === "autumn" ? n % 4 : n % 2],
      x,
      y,
      body: { x: x - 10, y: y - 10, width: 20, height: 10 },
    });
  }
  structures.push(...trees);
  return { structures, entrances, walls: [...TERRAIN_WALLS, ...FOUNTAIN_BODIES] };
}

/** 가을에 잎이 지는 나무인지 (단풍·은행·감나무, 위 `treeArts`·`persimmon` 고르기와 같은 규칙). 바닥 낙엽을 그 아래에 모은다 */
export function shedsLeaves(s: Pick<Structure, "id">): boolean {
  const m = /^tree:(\d+)$/.exec(s.id);
  if (!m) return false;
  const n = Number(m[1]);
  return n % 7 === 3 || n % 4 === 1 || n % 4 === 2;
}

/** 장대 꼭대기 (내 초롱을 얹는 점, 그림의 맨 윗줄 가운데) */
export function mastTop(): Point {
  return { x: MAST_POS.x, y: MAST_POS.y - artSize(mastArt()).height };
}

/** ✨ 텔레포트 한 줄 (TOWN-12): 고르면 그 앞(`x`, `y`)으로. 빈 집터는 고를 수 없다 */
export type TownSpot = { id: string; label: string; sub: string | null; x: number; y: number; enabled: boolean; slug: string | null };

export const EMPTY_LOT_HINT = "친구 목록에서 ⭐를 누르면 집이 생겨요";

/**
 * 텔레포트 목록: `마을` 9곳(분수·줄등·게시판·글감·상점·옷가게·미용실·농장·낚시터) + 집 11자리. 게임과 같은 좌표(입구 앞)를 쓴다.
 * 빈 집터의 부제(⭐ 안내)는 회원에게만. 방문자의 0번 자리는 '여기에 내 집 짓기'.
 */
export function townSpots(houses: readonly TownHouseInput[], member: boolean): { places: TownSpot[]; houses: TownSpot[] } {
  const door = (id: string) => BOARD_POS.x + BOARD_DOORS.find((d) => d.id === id)!.dx;
  const places: TownSpot[] = [
    { id: "fountain", label: "⛲ 광장 분수", sub: null, ...START_POS, enabled: true, slug: null },
    { id: "lanterns", label: "🏮 줄등", sub: null, x: MAST_POS.x, y: LANTERN_SPOT_Y, enabled: true, slug: null },
    { id: "board", label: "📋 마을 게시판", sub: null, x: door("feed"), y: BOARD_POS.y + 30, enabled: true, slug: null },
    { id: "prompt", label: "📝 이번 주 글감", sub: null, x: door("prompt"), y: BOARD_POS.y + 30, enabled: true, slug: null },
    { id: "shop", label: "🏪 상점", sub: null, x: SHOP_POS.x + 40, y: SHOP_POS.y + 30, enabled: true, slug: null },
    { id: "clothes", label: "👗 옷가게", sub: null, x: CLOTHES_POS.x + 30, y: CLOTHES_POS.y + 30, enabled: true, slug: null },
    { id: "salon", label: "💇 미용실", sub: null, x: SALON_POS.x + 30, y: SALON_POS.y + 30, enabled: true, slug: null },
    { id: "farm", label: "🐮 동물 농장", sub: null, x: FARM_POS.x, y: FARM_POS.y + 30, enabled: true, slug: null },
    { id: "pond", label: "🎣 낚시터", sub: null, x: POND_POS.x, y: POND_POS.y + 30, enabled: true, slug: null },
  ];
  const lots = HOUSE_LOTS.map((_, i): TownSpot => {
    const house = houses.find((h) => h.lot === i);
    const front = lotFront(i);
    if (house?.suggested) return { id: `house:${i}`, label: `🏡 이사 올 집 · ${shortName(house.nickname)}`, sub: house.blogTitle, ...front, enabled: true, slug: null };
    if (house) return { id: `house:${i}`, label: house.mine ? "🏠 내 집" : `🏠 ${shortName(house.nickname)}의 집`, sub: house.blogTitle, ...front, enabled: true, slug: house.slug };
    if (i === 0 && !member) return { id: "house:0", label: GUEST_HOME_LABEL, sub: null, ...front, enabled: true, slug: null };
    return { id: `lot:${i}`, label: i === 0 ? "내 집 자리" : "빈 집터", sub: i === 0 || !member ? null : EMPTY_LOT_HINT, ...front, enabled: false, slug: null };
  });
  return { places, houses: lots };
}

/** 🏮 줄등 텔레포트 자리 (장대 북쪽, 내 초롱 아래) */
const LANTERN_SPOT_Y = 700;
