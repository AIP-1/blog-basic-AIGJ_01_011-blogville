// 사이트 도트 그림 (광장 개편): 헤더 로고 앞 집 마크(파비콘·홈 화면 아이콘·공유 그림도 같은 집)와 쪽 머리의 작은 그림.
// 마을 그림(town.ts)과 같은 팔레트를 쓰고, 작게 그려도 읽히게 둘레에 먹선을 자동으로 두른다.
// 먹선 색은 기본 `currentColor`라 글자색을 따른다(어두운 화면이면 밝은 선). 파일로 굳힌 아이콘은 먹색을 직접 넘긴다.
import type { PixelArt } from "./characters";

/** 브랜드 초록 (globals.css --accent, 아이콘·주소창 색) */
export const BRAND_GREEN = "#2a7348";
/** 먹선 (도트 키트 --kit-ink) */
export const INK = "#3b2a20";
/** 불 켜진 창 (광장 캔버스·마을 그림과 같은 색) */
const LIT = "#ffd56e";

type Grid = string[][];

function grid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => "."));
}

function fill(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (g[yy]?.[xx] !== undefined) g[yy][xx] = ch;
}

function dot(g: Grid, points: readonly (readonly [number, number])[], ch: string) {
  for (const [x, y] of points) if (g[y]?.[x] !== undefined) g[y][x] = ch;
}

/** 칠한 칸 바깥 한 칸(상하좌우)에 먹선 'K'. 먹선끼리는 다시 두르지 않는다 */
function outline(g: Grid) {
  const filled = (x: number, y: number) => {
    const c = g[y]?.[x];
    return c !== undefined && c !== "." && c !== "K";
  };
  const edge: [number, number][] = [];
  g.forEach((row, y) =>
    row.forEach((c, x) => {
      if (c === "." && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) edge.push([x, y]);
    }),
  );
  for (const [x, y] of edge) g[y][x] = "K";
}

/** 빈 테두리 줄·칸을 잘라 그림 크기를 칠한 곳에 맞춘다 (머리 줄에서 가운데가 맞게) */
function art(g: Grid, palette: Record<string, string>): PixelArt {
  const rows = g.map((r) => r.join(""));
  const used = (s: string) => /[^.]/.test(s);
  const top = rows.findIndex(used);
  const bottom = rows.length - [...rows].reverse().findIndex(used);
  const cols = rows[0].length;
  const colUsed = (x: number) => rows.some((r) => r[x] !== ".");
  let left = 0;
  while (left < cols - 1 && !colUsed(left)) left++;
  let right = cols;
  while (right > left + 1 && !colUsed(right - 1)) right--;
  return { rows: rows.slice(Math.max(0, top), bottom).map((r) => r.slice(left, right)), palette };
}

/**
 * 집 마크 (16×14칸): 삼각 지붕·굴뚝·불 켜진 창 하나·문. 헤더 로고 앞(2px 칸)과 아이콘에 같은 그림을 쓴다.
 * `smoke`면 굴뚝 위에 김 두 덩이(위로 3칸 더)를 얹는다 (이웃 새 글 머리)
 */
export function houseMarkArt({ roof = BRAND_GREEN, ink = "currentColor", smoke = false }: { roof?: string; ink?: string; smoke?: boolean } = {}): PixelArt {
  const top = smoke ? 3 : 0;
  const g = grid(16, 14 + top);
  // 지붕 (꼭대기 두 칸에서 한 줄에 양쪽 한 칸씩)
  for (let r = 0; r < 6; r++) fill(g, 7 - r, top + 1 + r, 2 + r * 2, 1, "R");
  // 굴뚝: 오른쪽 비탈에 2×2
  fill(g, 10, top + 2, 2, 3, "C");
  // 처마 (먹선 한 줄)
  fill(g, 1, top + 7, 14, 1, "K");
  // 벽·창·문
  fill(g, 2, top + 8, 12, 5, "W");
  fill(g, 3, top + 9, 3, 2, "Y");
  fill(g, 10, top + 9, 2, 4, "D");
  outline(g);
  if (smoke) dot(g, [[11, 2], [12, 1], [13, 1], [12, 0], [13, 0], [14, 0]], "S");
  return art(g, { K: ink, R: roof, C: "#8a5a44", W: "#fbeed4", Y: LIT, D: "#9a6a3a", S: "#b8ad9c" });
}

/** 마을 게시판 (마을 소식 머리): 나무 지붕 판, 코르크에 꽂힌 쪽지 둘, 다리 둘 */
export function boardMarkArt(ink = "currentColor"): PixelArt {
  const g = grid(20, 15);
  fill(g, 1, 1, 18, 2, "R");
  fill(g, 1, 3, 18, 1, "K");
  fill(g, 2, 4, 16, 8, "F");
  fill(g, 3, 5, 14, 6, "C");
  fill(g, 4, 5, 4, 5, "P");
  fill(g, 5, 6, 2, 1, "p");
  fill(g, 5, 8, 2, 1, "p");
  fill(g, 10, 6, 5, 4, "Y");
  fill(g, 11, 7, 3, 1, "y");
  dot(g, [[5, 5], [12, 6]], "r");
  fill(g, 4, 12, 2, 2, "N");
  fill(g, 14, 12, 2, 2, "N");
  outline(g);
  return art(g, { K: ink, R: "#6b4226", F: "#9a6a3a", C: "#c9935a", P: "#ffffff", p: "#b8ad9c", Y: "#fff3a0", y: "#c9b25a", r: "#e74c3c", N: "#7a4a2a" });
}

/** 광장 분수 (인기 글 머리): 돌 수반과 가운데 물줄기 */
export function fountainMarkArt(ink = "currentColor"): PixelArt {
  const g = grid(18, 14);
  fill(g, 2, 8, 14, 1, "S");
  fill(g, 1, 9, 16, 1, "S");
  fill(g, 2, 9, 14, 1, "B");
  fill(g, 1, 10, 16, 1, "S");
  fill(g, 2, 11, 14, 1, "s");
  fill(g, 8, 4, 2, 4, "S");
  fill(g, 6, 4, 6, 1, "S");
  fill(g, 8, 2, 2, 2, "B");
  outline(g);
  // 물보라는 먹선 없이
  dot(g, [[7, 1], [10, 1], [6, 2], [11, 2], [5, 3], [12, 3], [4, 5], [13, 5], [4, 6], [13, 6]], "b");
  return art(g, { K: ink, S: "#c9c2b5", s: "#a39b8c", B: "#4fa8e0", b: "#4fa8e0" });
}

/** 갈림길 팻말 (태그 머리): 오른쪽·왼쪽을 가리키는 나무 판 둘 */
export function signpostMarkArt(ink = "currentColor"): PixelArt {
  const g = grid(18, 17);
  fill(g, 8, 1, 2, 15, "N");
  fill(g, 2, 2, 12, 4, "P");
  fill(g, 14, 3, 1, 2, "P");
  fill(g, 4, 3, 6, 1, "p");
  fill(g, 4, 9, 12, 4, "P");
  fill(g, 3, 10, 1, 2, "P");
  fill(g, 8, 11, 6, 1, "p");
  outline(g);
  return art(g, { K: ink, N: "#7a4a2a", P: "#d9b48a", p: "#8a5a34" });
}

/** 우체통 (알림함은 파란 내 우체통에 깃발이 오르고, 문의는 빨간 우체통에 편지를 넣는다) */
export function mailboxMarkArt({ mine = true, ink = "currentColor" }: { mine?: boolean; ink?: string } = {}): PixelArt {
  const g = grid(17, 17);
  fill(g, 3, 3, 8, 1, "B");
  fill(g, 2, 4, 10, 6, "B");
  fill(g, 4, 6, 6, 1, "k");
  fill(g, 6, 10, 2, 5, "P");
  if (mine) {
    // 깃발이 올랐다 (새 소식)
    fill(g, 13, 2, 1, 7, "N");
    fill(g, 14, 2, 2, 2, "F");
  } else {
    // 깃발은 내려 두고, 편지 한 장을 넣는 중
    fill(g, 13, 6, 1, 3, "N");
    fill(g, 14, 6, 2, 1, "F");
    fill(g, 4, 1, 5, 4, "W");
    dot(g, [[5, 2], [7, 2], [6, 3]], "w");
  }
  outline(g);
  return art(g, { K: ink, B: mine ? "#4a90d9" : "#d9534f", k: "#2b2b2b", P: "#6b4a2f", N: "#6b4a2f", F: "#ffd23f", W: "#ffffff", w: "#b8ad9c" });
}

/** 새싹 (업데이트 소식 머리): 흙 위 떡잎 둘과 반짝임 */
export function sproutMarkArt(ink = "currentColor"): PixelArt {
  const g = grid(16, 15);
  fill(g, 2, 11, 12, 2, "E");
  fill(g, 7, 6, 2, 5, "L");
  fill(g, 3, 6, 4, 2, "L");
  fill(g, 4, 5, 2, 1, "L");
  fill(g, 9, 4, 4, 2, "L");
  fill(g, 10, 3, 2, 1, "L");
  dot(g, [[4, 6], [10, 4]], "l");
  outline(g);
  dot(g, [[13, 1], [12, 2], [14, 2], [13, 3], [2, 2]], "Y");
  return art(g, { K: ink, E: "#8a5a34", L: "#5cb85c", l: "#8fd27c", Y: "#f4c430" });
}

/** 나무 의자와 책 (스크랩 머리: 나중에 앉아 읽을 글) */
export function benchMarkArt(ink = "currentColor"): PixelArt {
  const g = grid(20, 12);
  fill(g, 1, 1, 18, 2, "W");
  fill(g, 1, 6, 18, 2, "W");
  fill(g, 3, 3, 1, 3, "N");
  fill(g, 16, 3, 1, 3, "N");
  fill(g, 3, 8, 2, 3, "N");
  fill(g, 15, 8, 2, 3, "N");
  outline(g);
  fill(g, 8, 4, 5, 2, "b");
  fill(g, 9, 4, 3, 1, "p");
  return art(g, { K: ink, W: "#b07a4a", N: "#5a3d26", b: "#c0392b", p: "#fbeed4" });
}

/** 쪽 머리 그림 이름 → 그림 */
export const PAGE_MARKS = {
  board: () => boardMarkArt(),
  litHouse: () => houseMarkArt({ roof: "#f0883e", smoke: true }),
  fountain: () => fountainMarkArt(),
  signpost: () => signpostMarkArt(),
  mailbox: () => mailboxMarkArt({ mine: true }),
  letter: () => mailboxMarkArt({ mine: false }),
  sprout: () => sproutMarkArt(),
  bench: () => benchMarkArt(),
} as const;
export type PageMark = keyof typeof PAGE_MARKS;
