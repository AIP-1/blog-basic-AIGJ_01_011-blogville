import type { PixelArt } from "./characters";

// 걷는 그림 (TOWN-17, specs/048-walk): 입은 모습(캐릭터 + 아이템) 16×16을 한 장으로 겹친 뒤
// 방향(앞·왼쪽·오른쪽·뒤)마다 서 있기 1칸 + 걷기 4칸을 코드로 만든다. 부품을 한 장에서 같이 옮겨 어긋나지 않는다.

export type WalkDir = "down" | "left" | "right" | "up";
export const WALK_DIRS: readonly WalkDir[] = ["down", "left", "right", "up"];
/** 걷기 칸 수와 1초에 넘기는 칸 수 */
export const WALK_FRAMES = 4;
export const WALK_FPS = 8;

/** 칸마다 색(빈칸은 null), 16줄 × 16칸 */
export type ColorGrid = (string | null)[][];

/** 얼굴 줄 (캐릭터 그림에서 눈·볼이 있는 줄) */
const FACE_ROWS = [5, 6, 7, 8];
/** 다리 줄: 걸을 때 한쪽씩 든다 */
const LEG_ROWS = [14, 15];

/** 그림 여러 장을 아래 → 위로 겹친다 */
export function composeArt(arts: readonly PixelArt[]): ColorGrid {
  const h = arts[0]?.rows.length ?? 16;
  const w = arts[0]?.rows[0].length ?? 16;
  const grid: ColorGrid = Array.from({ length: h }, () => Array<string | null>(w).fill(null));
  for (const art of arts) {
    art.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== ".") grid[y][x] = art.palette[ch] ?? grid[y][x];
      });
    });
  }
  return grid;
}

const copy = (g: ColorGrid): ColorGrid => g.map((r) => [...r]);

/** 줄 안에서 테두리 색 사이(머리·얼굴 안쪽)의 범위 */
function inner(row: (string | null)[], outline: string): [number, number] | null {
  const first = row.indexOf(outline);
  const last = row.lastIndexOf(outline);
  return first >= 0 && last - first > 1 ? [first + 1, last - 1] : null;
}

/** 뒷모습: 얼굴 줄 안쪽을 머리색으로 덮는다 */
function back(g: ColorGrid, outline: string, hair: string): ColorGrid {
  const out = copy(g);
  for (const y of FACE_ROWS) {
    const span = inner(out[y], outline);
    if (!span) continue;
    for (let x = span[0]; x <= span[1]; x++) out[y][x] = hair;
  }
  return out;
}

/** 왼쪽 옆모습: 얼굴 줄 안쪽을 한 칸 왼쪽으로 돌리고 뒤통수(오른쪽 끝)는 머리색 */
function sideLeft(g: ColorGrid, outline: string, hair: string): ColorGrid {
  const out = copy(g);
  for (const y of FACE_ROWS) {
    const span = inner(out[y], outline);
    if (!span) continue;
    for (let x = span[0]; x < span[1]; x++) out[y][x] = g[y][x + 1];
    out[y][span[1]] = hair;
  }
  return out;
}

const mirror = (g: ColorGrid): ColorGrid => g.map((r) => [...r].reverse());

/**
 * 걷기 칸: 1·3칸은 몸이 한 칸 올라가고 한쪽 발(1칸 왼발, 3칸 오른발)을 든다. 2·4칸은 서 있는 그림.
 * 몸을 올린 자리는 허리 줄을 한 번 더 그려 메운다.
 */
function step(g: ColorGrid, frame: number): ColorGrid {
  if (frame % 2 === 0) return copy(g);
  const h = g.length;
  const w = g[0].length;
  const out = copy(g);
  const lastBody = LEG_ROWS[0] - 2;
  for (let y = 0; y <= lastBody; y++) out[y] = [...g[y + 1]];
  out[lastBody + 1] = [...g[lastBody + 1]];
  const lift = (x: number) => (frame === 1 ? x < w / 2 : x >= w / 2);
  for (let x = 0; x < w; x++) {
    if (!lift(x)) continue;
    for (const y of LEG_ROWS) out[y][x] = y + 1 < h ? g[y + 1][x] : null;
  }
  return out;
}

/**
 * 방향 `dir`의 `frame`번 칸 (0 = 서 있기, 1~4 = 걷기). `arts[0]`은 캐릭터 그림이고 그 팔레트의
 * `K`(테두리)·`H`(머리)로 옆·뒷모습을 만든다. 오른쪽은 왼쪽의 좌우 반전.
 */
export function walkFrame(arts: readonly PixelArt[], dir: WalkDir, frame: number): ColorGrid {
  const base = composeArt(arts);
  const outline = arts[0]?.palette.K ?? "#3b2a20";
  const hair = arts[0]?.palette.H ?? outline;
  const facing = dir === "up" ? back(base, outline, hair) : dir === "down" ? base : sideLeft(base, outline, hair);
  const stepped = step(facing, frame);
  return dir === "right" ? mirror(stepped) : stepped;
}

/** 움직임 방향 → 그림 방향 (대각선은 더 크게 움직이는 쪽) */
export function walkDir(dx: number, dy: number, current: WalkDir): WalkDir {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}
