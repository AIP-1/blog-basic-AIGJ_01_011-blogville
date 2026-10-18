// 작은 마을 그림 (광장 개편 "등불 마을"): 랜딩 첫 화면과 휴대폰 광장 머리에 서는 정지 그림(SVG)을 칸 단위로 짠다.
// 게임 캔버스(TownGame)와 같은 규칙을 따른다: 하늘은 sky.ts, 세계는 SKY_TINT로 multiply 덧칠, 불빛(글 쓴 집 창·가로등)은
// 덧칠 위에 그대로 밝다. 캔버스처럼 그릴 때마다 합성하지 않고 팔레트 색을 미리 곱해 둔다(그림은 한 번, 색마다 path 하나).

import type { PixelArt } from "@/lib/art/characters";
import { chimneyTop, HOUSE_ART_WIDTH, houseArt, lampArt, LIT_GLASS, LIT_GLOW, mailboxArt, smokeArt, SMOKE_FRAMES, treeArt } from "@/lib/art/town";
import type { Season } from "./season";
import { lampsOn, SKY_TINT, type Sky } from "./sky";

/** 집 한 채 자리 (집 그림 40칸 + 양옆 2칸) */
export const DIORAMA_SLOT = HOUSE_ART_WIDTH + 4;
/** 그림 양끝 여백 (칸) */
export const DIORAMA_PAD = 6;
/** 그림에 세우는 집은 이만큼까지 (휴대폰 폭에서 집이 읽히는 수) */
export const DIORAMA_MAX_HOUSES = 5;
/** 가장 높은 집 위 하늘 (칸) */
const HEAD = 6;
/** 집 밑변 아래 땅: 잔디 2줄 · 흙길 4줄 · 잔디 3줄 */
const GROUND = 9;

// 글 쓴 집의 창 색(LIT_GLASS 낮, LIT_GLOW 노을·밤·새벽)과 굴뚝 연기는 광장 캔버스와 같은 것을 쓴다 (lib/art/town.ts)
export { LIT_GLASS, LIT_GLOW, SMOKE_FRAMES };
const LAMP_ON = "#ffe28a";
const LAMP_OFF = "#d5dde0";
/**
 * 따뜻한 빛 무리 고리 색과 진하기 (안쪽부터, 밤 기준; 노을은 0.8배). 옅은 노랑(#ffd56e .35 같은)을 남색 하늘 위에 얹으면
 * 회갈색으로 탁해져서, 채도 높은 호박빛을 더 진하게 얹고 맨 바깥은 한 칸 걸러 찍어(디더) 어두운 테 없이 흩어지게 한다.
 */
export const GLOW_RINGS = {
  core: { color: "#fff0b8", alpha: 0.95 },
  inner: { color: "#ffc54a", alpha: 0.78 },
  mid: { color: "#ffa526", alpha: 0.55 },
  outer: { color: "#ffb347", alpha: 0.6 },
} as const;

/** 하늘 띠 네 줄 (위 → 지평선). 노을·밤은 덧칠 색(SKY_TINT)과 같은 쪽 색이다 */
const SKY_BANDS: Record<Sky, readonly [string, string, string, string]> = {
  dawn: ["#8e98d4", "#b3a9df", "#dfb7d4", "#f6d2c2"],
  day: ["#8fd3fb", "#a6dcfb", "#bfe6ff", "#d8f1ff"],
  dusk: ["#5b5a9e", "#97689f", "#de8488", "#f4b16a"],
  night: ["#141938", "#1b214b", "#252c5f", "#323a74"],
};

/** 해·달 (덧칠하지 않는 빛) */
const SUN: Record<Sky, { color: string; core: string }> = {
  dawn: { color: "#ffd9a0", core: "#fff1d6" },
  day: { color: "#ffe28a", core: "#fff6c8" },
  dusk: { color: "#ffb45e", core: "#ffd88a" },
  night: { color: "#fff3c4", core: "#fffbe8" },
};

/** 땅 색 (덧칠 전, 광장 바닥 ground.ts와 같은 잔디·흙길) */
const LAND = {
  far: "#a7bfd6",
  hill: "#6f9f6a",
  grass: "#7cc46a",
  grassHi: "#8fd27c",
  grassLo: "#6db35c",
  path: "#d9b98a",
  pathEdge: "#b8925f",
  pebble: "#cfae7d",
} as const;

type Land = { -readonly [K in keyof typeof LAND]: string };

/**
 * 계절 팔레트 (plaza-upgrade-2 C5, 광장 캔버스와 같은 seasonAt): 여름은 기본 땅 색 그대로,
 * 봄은 연두와 분홍 꽃 나무, 가을은 누런 잔디·단풍 언덕·단풍 나무, 겨울은 눈 덮인 땅과 앙상한 나무.
 */
const SEASON_LAND: Record<Season, Partial<Land>> = {
  spring: { hill: "#86b46e", grass: "#92d07a", grassHi: "#a6dc8c", grassLo: "#7dbd66" },
  summer: {},
  autumn: { hill: "#b9783a", grass: "#a9bd5e", grassHi: "#c2c96a", grassLo: "#92a24c", far: "#b3a6c4" },
  winter: { far: "#c3cfdd", hill: "#dbe4ea", grass: "#eef3f6", grassHi: "#ffffff", grassLo: "#d3dee5", path: "#d8cbb4", pathEdge: "#b5a58a", pebble: "#c8b99e" },
};

/** 계절 나무 잎 색 (treeArt의 L 잎·D 그늘·H 밝은 잎). 두 그루가 조금 다르다 */
const SEASON_TREE: Record<Season, readonly [Record<string, string>, Record<string, string>]> = {
  spring: [
    { L: "#f4a7c0", D: "#e0819f", H: "#ffd3e1" },
    { L: "#7cc46a", D: "#5ea64e", H: "#a6dc8c" },
  ],
  summer: [{}, {}],
  autumn: [
    { L: "#e07b2e", D: "#b85a1e", H: "#f4b04a" },
    { L: "#c8452c", D: "#9a3320", H: "#e9b341" },
  ],
  winter: [
    { L: "#e6edf2", D: "#b9c6cf", H: "#ffffff" },
    { L: "#d5dfe6", D: "#a9b7c1", H: "#ffffff" },
  ],
};

/** 계절 땅 색 */
export function seasonLand(season: Season | undefined): Land {
  return { ...LAND, ...(season ? SEASON_LAND[season] : {}) };
}

/** 계절 나무 (variant 0·1) */
export function seasonTreeArt(variant: number, season: Season | undefined): PixelArt {
  const tree = treeArt(variant);
  if (!season) return tree;
  return { rows: tree.rows, palette: { ...tree.palette, ...SEASON_TREE[season][variant % 2] } };
}

const HEX = /^#[0-9a-f]{6}$/i;

/** 색 하나에 그 하늘의 덧칠(multiply)을 미리 곱한다. 낮은 그대로 */
export function tintHex(hex: string, sky: Sky): string {
  const tint = SKY_TINT[sky];
  if (!tint || !HEX.test(hex)) return hex;
  const c = parseInt(hex.slice(1), 16);
  const t = parseInt(tint.color.slice(1), 16);
  const ch = (shift: number) => {
    const base = (c >> shift) & 255;
    const k = (t >> shift) & 255;
    return Math.round(base * (1 - tint.alpha + (tint.alpha * k) / 255));
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

/** 그림의 모든 색을 덧칠하고, `lights`에 적은 칸은 그 색으로 밝게 둔다 (창 불빛·등) */
export function tintArt(art: PixelArt, sky: Sky, lights: Readonly<Record<string, string>> = {}): PixelArt {
  const palette: Record<string, string> = {};
  for (const [ch, color] of Object.entries(art.palette)) palette[ch] = lights[ch] ?? tintHex(color, sky);
  return { rows: art.rows, palette };
}

/** `ch` 칸 둘레 한 칸 (칸 자체는 빼고): 밤에 불 켜진 창 둘레의 옅은 빛 */
export function haloArt(source: PixelArt, ch: string, color: string): PixelArt {
  const h = source.rows.length;
  const w = source.rows[0]?.length ?? 0;
  const at = (x: number, y: number) => source.rows[y]?.[x] === ch;
  const rows = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (!at(x, y) && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) ? "h" : ".")).join(""),
  );
  return { rows, palette: { h: color } };
}

/** 계단 모양 원판 (지름 2r+1칸): 가로등 빛 무리 */
export function discArt(r: number, color: string, squash = 1): PixelArt {
  const size = r * 2 + 1;
  const h = Math.max(1, Math.round(size * squash));
  const rows = Array.from({ length: h }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const dy = ((y + 0.5) / h) * size - size / 2;
      const dx = x + 0.5 - size / 2;
      return dx * dx + dy * dy <= (r + 0.35) * (r + 0.35) ? "g" : ".";
    }).join(""),
  );
  return { rows, palette: { g: color } };
}

/** 계단 모양 고리 (반지름 `inner` 바깥 ~ `outer` 안쪽 칸만). 고리마다 한 색·한 진하기라 겹쳐 진해지지 않는다. `dither`면 한 칸 걸러 */
export function ringArt(inner: number, outer: number, color: string, opts: { squash?: number; dither?: boolean } = {}): PixelArt {
  const { squash = 1, dither = false } = opts;
  const disc = discArt(outer, color, squash);
  const hole = inner > 0 ? discArt(inner, color, squash) : null;
  const dy = hole ? Math.round((disc.rows.length - hole.rows.length) / 2) : 0;
  const dx = outer - inner;
  const rows = disc.rows.map((row, y) =>
    Array.from(row, (ch, x) => (hole?.rows[y - dy]?.[x - dx] === "g" || (dither && (x + y) % 2 === 1) ? "." : ch)).join(""),
  );
  return { rows, palette: disc.palette };
}

/**
 * (cx, cy)를 가운데로 한 따뜻한 빛 무리: 바깥부터 디더 고리 · 호박빛 고리 · 노란 고리 · 흰 가운데 (`radii` 안쪽부터 core·inner·mid·outer 칸).
 * core가 0이면 가운데는 비운다 (초롱처럼 그림이 덮는 자리). `k`는 진하기 배율
 */
export function warmGlow(cx: number, cy: number, radii: readonly [number, number, number, number], k = 1): Glow[] {
  const [core, inner, mid, outer] = radii;
  const R = GLOW_RINGS;
  const glows: Glow[] = [
    { x: cx - outer, y: cy - outer, art: ringArt(mid, outer, R.outer.color, { dither: true }), opacity: R.outer.alpha * k },
    { x: cx - mid, y: cy - mid, art: ringArt(inner, mid, R.mid.color), opacity: R.mid.alpha * k },
    { x: cx - inner, y: cy - inner, art: ringArt(core, inner, R.inner.color), opacity: R.inner.alpha * k },
  ];
  if (core > 0) glows.push({ x: cx - core, y: cy - core, art: discArt(core, R.core.color), opacity: R.core.alpha * k });
  return glows;
}

/** 굴뚝 연기 한 장 (광장 캔버스의 `smokeArt`와 같다). CSS steps()로 장을 넘긴다 */
export const smokeFrame = smokeArt;

/** 그림 위의 한 장 (칸 좌표, 왼쪽 위) */
export type Placed = { x: number; y: number; art: PixelArt };
/** 옅게 얹는 빛 (fill-opacity) */
export type Glow = Placed & { opacity: number };

export type DioramaInput = { stage: number; roof: string; fresh?: boolean; mine?: boolean };

export type DioramaHousePlaced = Placed & {
  /** 집 가운데 x (칸): 아래 글씨를 맞춘다 */
  center: number;
  lit: boolean;
  /** 굴뚝 연기 장들 (불 켜진 집만) */
  smoke: Placed[] | null;
};

/** 집 위 줄등에 매단 소형 초롱 한 개 (칸 좌표, 왼쪽 위). 글 쓴 집이면 켜진다 */
export type DioramaLantern = { x: number; y: number; lit: boolean };

/** 소형 초롱 칸 크기 (lanternArt 's') */
export const LANTERN_SIZE = { width: 5, height: 8 } as const;
/** 줄등 처짐 (칸, 칸 3px이면 6px) */
export const LANTERN_SAG = 2;
/** 줄등을 걸 때 하늘을 이만큼 더 둔다 (칸) */
const LANTERN_HEAD = 11;

export type DioramaScene = {
  width: number;
  height: number;
  season: Season | null;
  /** 줄등 (켰을 때만): 양끝 높이·가운데 처짐 줄과 집마다 초롱 */
  string: { y: number; sag: number; lanterns: DioramaLantern[] } | null;
  /** 집 밑변이 닿는 줄 */
  baseY: number;
  /** 하늘·언덕·땅 한 장 */
  backdrop: PixelArt;
  /** 집 뒤 (양끝 나무) */
  back: Placed[];
  houses: DioramaHousePlaced[];
  /** 집 위에 얹는 빛 (창 둘레·가로등 무리) */
  glows: Glow[];
  /** 집 앞 (우체통·가로등) */
  front: Placed[];
};

/** 휴대폰 광장 머리 그림에 세우는 집 수: 내 집 + 이웃 2채 (390px 폭에서 집과 이름이 줄지 않고 읽히는 수) */
export const PHONE_DIORAMA_HOUSES = 3;

/** 휴대폰 광장 머리 그림에 고르는 집의 모양 (server/town TownHouse 중 쓰는 것만) */
export type PlazaHouseLike = { mine: boolean; lot: number; fresh: boolean; recentPosts: readonly { createdAt: string }[] };

/**
 * 휴대폰 광장 머리 그림의 집: 내 집을 맨 앞에, 이웃은 불 켜진 집(24시간 안에 글) 중 가장 최근에 글 쓴 집부터,
 * 모자라면 자리 순(1번 자리부터). 모두 `max`채까지
 */
export function phonePlazaHouses<T extends PlazaHouseLike>(houses: readonly T[], max = PHONE_DIORAMA_HOUSES): T[] {
  const mine = houses.filter((h) => h.mine).slice(0, 1);
  const latest = (h: T) => (h.recentPosts[0] ? Date.parse(h.recentPosts[0].createdAt) || 0 : 0);
  const neighbors = houses
    .filter((h) => !h.mine && h.lot > 0)
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || (a.fresh && b.fresh ? latest(b) - latest(a) : 0) || a.lot - b.lot);
  return [...mine, ...neighbors].slice(0, Math.max(0, max));
}

/** 자리 수에 맞춘 그림 폭 (칸) */
export function dioramaWidth(count: number): number {
  return DIORAMA_PAD * 2 + DIORAMA_SLOT * Math.max(1, Math.min(count, DIORAMA_MAX_HOUSES));
}

/** 칸 좌표의 의사 난수 (별 자리처럼 그릴 때마다 같아야 하는 것) */
function hash(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** 하늘(띠 넷, 띠 사이 바둑 무늬 한 줄)·해나 달·먼 산·언덕·잔디·흙길 */
function backdropArt(sky: Sky, width: number, height: number, baseY: number, sunX: number, season?: Season): PixelArt {
  const land = seasonLand(season);
  const g = Array.from({ length: height }, () => Array.from({ length: width }, () => "."));
  const set = (x: number, y: number, ch: string) => {
    if (y >= 0 && y < height && x >= 0 && x < width) g[y][x] = ch;
  };
  // 띠 경계 앞뒤 세 줄은 2×2 바이어 무늬로 다음 띠 색을 25%·50%·75% 섞는다 (도트 하늘의 계단 그러데이션)
  const bandH = baseY / 4;
  const bayer = [
    [0, 2],
    [3, 1],
  ];
  for (let y = 0; y < baseY; y++) {
    const band = Math.min(3, Math.floor(y / bandH));
    const next = Math.floor((band + 1) * bandH);
    const prev = Math.floor(band * bandH);
    // 다음 띠로 넘어가는 비율: 경계 두 줄 앞 25%, 한 줄 앞 50% / 새 띠 첫 줄은 앞 띠를 25% 남긴다
    const toNext = band < 3 && next - y === 2 ? 1 : band < 3 && next - y === 1 ? 2 : 0;
    const keepPrev = band > 0 && y === prev ? 1 : 0;
    for (let x = 0; x < width; x++) {
      const b = bayer[y % 2][x % 2];
      g[y][x] = String(b < toNext ? band + 1 : b < keepPrev ? band - 1 : band);
    }
  }
  // 해·달: 낮·밤은 높이, 새벽·노을은 지평선 가까이(언덕 뒤로 반쯤). 밤은 초승달과 별
  const sunY = sky === "day" ? Math.round(baseY * 0.28) : sky === "night" ? Math.round(baseY * 0.3) : baseY - 9;
  const sunR = sky === "dusk" || sky === "dawn" ? 6 : 4;
  for (let y = -sunR; y <= sunR; y++) {
    for (let x = -sunR; x <= sunR; x++) {
      const d = x * x + y * y;
      if (d > (sunR + 0.4) ** 2) continue;
      // 초승달: 오른쪽 위로 비킨 원을 깎는다
      if (sky === "night" && (x - 2) ** 2 + (y + 1) ** 2 <= (sunR - 0.3) ** 2) continue;
      set(sunX + x, sunY + y, d <= (sunR - 2) ** 2 ? "o" : "O");
    }
  }
  if (sky === "night") {
    for (let y = 1; y < baseY - 10; y++) {
      for (let x = 1; x < width - 1; x++) {
        const r = hash(x, y);
        if (r < 0.012 && g[y][x] !== "O" && g[y][x] !== "o") g[y][x] = r < 0.004 ? "*" : "+";
      }
    }
  }
  if (sky === "day") {
    // 구름 하나: 해 반대쪽
    const cx = Math.round(width * 0.22);
    const cy = Math.round(baseY * 0.32);
    for (const [dx, dy, w] of [
      [2, -2, 6],
      [0, -1, 11],
      [-2, 0, 16],
    ] as const)
      for (let x = 0; x < w; x++) set(cx + dx + x, cy + dy, "c");
  }
  // 먼 산(파란 능선)과 가까운 언덕: 지평선 위로 물결
  for (let x = 0; x < width; x++) {
    const far = Math.round(9 + 3 * Math.sin(x / 11 + 0.6) + 1.5 * Math.sin(x / 4.7));
    const near = Math.round(4 + 2 * Math.sin(x / 8.3 + 2.1) + Math.sin(x / 3.1));
    for (let y = baseY - far; y < baseY; y++) set(x, y, "m");
    for (let y = baseY - near; y < baseY; y++) set(x, y, "h");
  }
  // 땅: 잔디 2줄 → 흙길 4줄(위아래 가장자리) → 잔디
  for (let y = baseY; y < height; y++) {
    const r = y - baseY;
    for (let x = 0; x < width; x++) {
      let ch = "G";
      if (r >= 2 && r <= 5) ch = r === 2 || r === 5 ? "e" : hash(x, y) < 0.08 ? "p" : "P";
      else if (hash(x, y) < 0.1) ch = hash(y, x) < 0.5 ? "g" : "l";
      g[y][x] = ch;
    }
  }
  const t = (hex: string) => tintHex(hex, sky);
  const [s0, s1, s2, s3] = SKY_BANDS[sky];
  return {
    rows: g.map((r) => r.join("")),
    palette: {
      "0": s0,
      "1": s1,
      "2": s2,
      "3": s3,
      O: SUN[sky].color,
      o: SUN[sky].core,
      "*": "#fff3c4",
      "+": "#aab4e8",
      c: "#ffffff",
      m: t(land.far),
      h: t(land.hill),
      G: t(land.grass),
      g: t(land.grassLo),
      l: t(land.grassHi),
      P: t(land.path),
      p: t(land.pebble),
      e: t(land.pathEdge),
    },
  };
}

/**
 * 그림 한 장의 배치. 집은 왼쪽부터 자리마다 한 채(최대 `DIORAMA_MAX_HOUSES`), 밑변을 한 줄에 맞춘다.
 * 글 쓴 집(`fresh`)은 창에 불이 켜지고 굴뚝 연기·우체통 깃발이 오른다. 가로등은 집 사이에 서고 낮이 아니면 켜진다.
 */
export function dioramaScene(input: readonly DioramaInput[], sky: Sky, opts: { season?: Season | null; lanterns?: boolean } = {}): DioramaScene {
  const season = opts.season ?? undefined;
  const list = input.slice(0, DIORAMA_MAX_HOUSES);
  const width = dioramaWidth(list.length);
  const arts = list.map((h) => houseArt(h.stage, h.roof));
  const tallest = Math.max(30, ...arts.map((a) => a.rows.length));
  const baseY = HEAD + (opts.lanterns ? LANTERN_HEAD : 0) + tallest;
  const height = baseY + GROUND;
  const night = sky !== "day";
  const lamps = lampsOn(sky);

  const houses: DioramaHousePlaced[] = [];
  const glows: Glow[] = [];
  const front: Placed[] = [];
  list.forEach((h, i) => {
    const raw = arts[i];
    const lit = !!h.fresh;
    const x = DIORAMA_PAD + i * DIORAMA_SLOT + 2;
    const y = baseY - raw.rows.length;
    const lights: Record<string, string> = {};
    if (lit) lights.G = night ? LIT_GLOW : LIT_GLASS;
    if (lamps) lights.L = LAMP_ON; // 1단계 집 문 옆 작은 등
    const art = tintArt(raw, sky, lights);
    const top = chimneyTop(raw);
    const smoke = lit && top ? Array.from({ length: SMOKE_FRAMES }, (_, f) => ({ x: x + top.x - 4.5, y: y + top.y - 12, art: tintArt(smokeFrame(f), sky) })) : null;
    houses.push({ x, y, art, center: x + HOUSE_ART_WIDTH / 2, lit, smoke });
    if (lit && night) glows.push({ x, y, art: haloArt(raw, "G", LIT_GLOW), opacity: 0.45 });
    // 우체통: 집 오른쪽 앞 잔디 위. 글 쓴 집은 깃발이 오른다
    front.push({ x: x + 31, y: baseY + 1 - 12, art: tintArt(mailboxArt(!!h.mine, lit), sky) });
  });

  // 가로등: 집 사이마다 (한 채뿐이면 오른쪽 끝에 하나)
  const lampXs = list.length > 1 ? list.slice(1).map((_, i) => DIORAMA_PAD + (i + 1) * DIORAMA_SLOT) : [width - DIORAMA_PAD];
  const lamp = lampArt();
  const lampArtLit = tintArt({ rows: lamp.rows, palette: { ...lamp.palette, L: lamps ? LAMP_ON : LAMP_OFF } }, sky, lamps ? { L: LAMP_ON } : {});
  for (const lx of lampXs) {
    const top = baseY + 1 - lamp.rows.length;
    if (lamps) {
      // 계단 고리 넷 (바깥은 디더). 남색 하늘 위에서도 회갈색이 아니라 호박빛으로 읽힌다 (D6)
      const k = sky === "night" ? 1 : 0.8;
      glows.push(...warmGlow(lx, top + 2, [1, 3, 5, 7], k));
      // 땅에 떨어진 빛 웅덩이 (납작한 고리 둘)
      glows.push({ x: lx - 7, y: baseY + 1, art: ringArt(4, 7, GLOW_RINGS.mid.color, { squash: 0.35 }), opacity: 0.35 * k });
      glows.push({ x: lx - 4, y: baseY + 2, art: discArt(4, GLOW_RINGS.inner.color, 0.35), opacity: 0.5 * k });
    }
    front.push({ x: lx - 3, y: top, art: lampArtLit });
  }

  // 양끝 나무 (집 뒤, 그림 끝에 반쯤 걸친다)
  const back: Placed[] = [
    { x: -5, y: baseY - 16, art: tintArt(seasonTreeArt(1, season), sky) },
    { x: width - 7, y: baseY - 16, art: tintArt(seasonTreeArt(0, season), sky) },
  ];

  // 줄등: 그림 양끝(2칸 높이)에서 가운데로 LANTERN_SAG칸 처지는 줄, 집 가운데마다 초롱 하나 (줄에서 한 칸 내려 단다)
  const lineY = 2;
  const string = opts.lanterns
    ? {
        y: lineY,
        sag: LANTERN_SAG,
        lanterns: houses.map((h) => ({ x: h.center - LANTERN_SIZE.width / 2, y: Math.round(stringY(h.center, width, lineY, LANTERN_SAG)) + 1, lit: h.lit })),
      }
    : null;

  // 해·달은 가장 낮은 두 집 사이 하늘에 (집 뒤로 숨지 않게)
  const gaps = list.length > 1 ? list.slice(1).map((_, i) => ({ x: lampXs[i], h: Math.max(arts[i].rows.length, arts[i + 1].rows.length) })) : [{ x: width - DIORAMA_PAD - 6, h: 0 }];
  const sunX = gaps.reduce((a, b) => (b.h < a.h ? b : a)).x;
  return { width, height, season: season ?? null, string, baseY, backdrop: backdropArt(sky, width, height, baseY, sunX, season), back, houses, glows, front };
}

/** 줄등 줄의 높이 (양끝 `y`, 가운데 `y + sag`의 포물선) */
export function stringY(x: number, width: number, y: number, sag: number): number {
  const t = (x - width / 2) / (width / 2);
  return y + sag * (1 - t * t);
}
