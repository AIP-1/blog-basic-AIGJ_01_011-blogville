// 마을 그림 (TOWN-03·04·11, specs/038-town). 캐릭터와 같은 도트 글자 그림을 코드로 만든다.
// 칸 하나는 마을에서 `TOWN_CELL` px로 그린다. 기준점은 그림의 아랫변 가운데(발밑).
import type { Season } from "@/lib/town/season";
import type { PixelArt } from "./characters";

/** 마을 그림 칸 하나의 크기 (px) */
export const TOWN_CELL = 5;

type Grid = string[][];

function grid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => "."));
}

/** 칸을 채운다 (그림 밖은 버린다) */
function fill(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (yy >= 0 && yy < g.length && xx >= 0 && xx < g[0].length) g[yy][xx] = ch;
    }
  }
}

/** 테두리만 */
function frame(g: Grid, x: number, y: number, w: number, h: number, ch: string) {
  fill(g, x, y, w, 1, ch);
  fill(g, x, y + h - 1, w, 1, ch);
  fill(g, x, y, 1, h, ch);
  fill(g, x + w - 1, y, 1, h, ch);
}

/** 가운데 `cx`(두 칸 사이)를 꼭짓점으로 하는 삼각 지붕: 위에서부터 한 줄에 양쪽 한 칸씩 넓어진다 */
function gable(g: Grid, cx: number, top: number, rows: number, ch: string, edge: string) {
  for (let r = 0; r < rows; r++) {
    const half = r + 1;
    fill(g, cx - half, top + r, half * 2, 1, ch);
    if (half > 0) {
      g[top + r][Math.max(0, cx - half)] = edge;
      g[top + r][Math.min(g[0].length - 1, cx + half - 1)] = edge;
    }
  }
  fill(g, cx - rows - 1, top + rows, rows * 2 + 2, 1, edge);
}

const art = (g: Grid, palette: Record<string, string>): PixelArt => ({
  rows: g.map((r) => r.join("")),
  palette,
});

export function darken(hex: string, amount = 0.25): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

export const HOUSE_ART_WIDTH = 40;

/**
 * 집 그림 (TOWN-11): 주인 레벨의 단계(1~10)마다 하나씩 더해진다.
 * 1 오두막(삼각 지붕·굴뚝·둥근 문·창문 하나·꽃 상자·작은 등) · 2 오른쪽 창문 · 3 다락 창과 깃발 · 4 꽃덤불 ·
 * 5 울타리 · 6 2층 · 7 발코니 · 8 왼쪽 탑 · 9 산울타리 정원 · 10 금빛 테두리와 왕관
 */
export function houseArt(stage: number, roof: string): PixelArt {
  const tall = stage >= 6;
  const height = tall ? 40 : 30;
  const g = grid(HOUSE_ART_WIDTH, height);
  const base = height - 1; // 맨 아랫줄
  const wallTop = base - 13; // 1층 벽 맨 윗줄
  const floor2 = tall ? wallTop - 10 : wallTop; // 지붕이 얹히는 줄
  const left = 9;
  const right = 30; // 벽은 left..right-1
  const cx = 20;

  // 탑 (8단계): 집 뒤 왼쪽에 둥근 탑
  if (stage >= 8) {
    fill(g, 3, floor2 - 8, 7, base - floor2 + 9, "T");
    fill(g, 3, floor2 - 8, 1, base - floor2 + 9, "t");
    gable(g, 6, floor2 - 14, 5, "R", "r");
    fill(g, 5, floor2 - 4, 2, 3, "G");
  }
  // 굴뚝
  fill(g, 24, floor2 - 9, 3, 7, "C");
  fill(g, 24, floor2 - 9, 3, 1, "c");
  // 지붕
  gable(g, cx, floor2 - 10, 10, "R", "r");
  if (stage >= 3) {
    // 다락 둥근 창과 깃발 (10단계는 깃발 대신 왕관)
    fill(g, 19, floor2 - 6, 2, 2, "G");
    frame(g, 18, floor2 - 7, 4, 4, "F");
    fill(g, 19, floor2 - 6, 2, 2, "G");
    if (stage >= 10) {
      fill(g, 17, floor2 - 14, 6, 2, "Y");
      g[floor2 - 15][17] = "Y";
      g[floor2 - 15][19] = "Y";
      g[floor2 - 15][20] = "Y";
      g[floor2 - 15][22] = "Y";
    } else {
      fill(g, 20, floor2 - 15, 1, 5, "N");
      fill(g, 21, floor2 - 15, 3, 2, "S");
    }
  }
  if (stage >= 10) fill(g, cx - 11, floor2, 22, 1, "Y");

  // 2층 (6단계)
  if (tall) {
    fill(g, left, floor2 + 1, right - left, 10, "W");
    fill(g, left, floor2 + 1, 1, 10, "w");
    for (const x of [12, 18, 24]) {
      frame(g, x, floor2 + 3, 4, 4, "F");
      fill(g, x + 1, floor2 + 4, 2, 2, "G");
    }
    fill(g, left - 1, wallTop - 1, right - left + 2, 1, "r");
    if (stage >= 7) {
      // 발코니: 가운데 창을 문으로, 앞에 난간
      fill(g, 18, floor2 + 3, 4, 7, "D");
      fill(g, 15, wallTop - 3, 10, 1, "N");
      for (let x = 15; x < 25; x += 2) fill(g, x, wallTop - 2, 1, 2, "N");
    }
  }

  // 1층 벽
  fill(g, left, wallTop, right - left, base - wallTop + 1, "W");
  fill(g, left, wallTop, 1, base - wallTop + 1, "w");
  // 둥근 문
  fill(g, 18, base - 7, 4, 8, "D");
  fill(g, 19, base - 8, 2, 1, "D");
  fill(g, 18, base - 7, 1, 8, "d");
  g[base - 3][21] = "K";
  if (stage >= 10) {
    fill(g, 17, base - 8, 1, 9, "Y");
    fill(g, 22, base - 8, 1, 9, "Y");
    fill(g, 18, base - 9, 4, 1, "Y");
  }
  // 왼쪽 창문과 꽃 상자
  frame(g, 11, wallTop + 3, 5, 5, "F");
  fill(g, 12, wallTop + 4, 3, 3, "G");
  fill(g, 11, wallTop + 8, 5, 1, "P");
  g[wallTop + 8][12] = "p";
  g[wallTop + 8][14] = "q";
  if (stage >= 2) {
    // 오른쪽 창문 (작은 등 대신)
    frame(g, 24, wallTop + 3, 5, 5, "F");
    fill(g, 25, wallTop + 4, 3, 3, "G");
  } else {
    // 문 옆 작은 등
    fill(g, 23, base - 6, 2, 2, "L");
    g[base - 4][23] = "N";
  }
  // 꽃덤불 (4단계)
  if (stage >= 4) {
    fill(g, left - 3, base - 3, 4, 4, "B");
    fill(g, right - 1, base - 3, 4, 4, "B");
    g[base - 2][left - 2] = "p";
    g[base - 3][right] = "q";
    g[base - 1][right + 1] = "p";
  }
  // 울타리 (5단계): 양옆
  if (stage >= 5) {
    for (const [x0, x1] of [
      [0, left - 3],
      [right + 3, HOUSE_ART_WIDTH],
    ] as const) {
      fill(g, x0, base - 3, x1 - x0, 1, "N");
      for (let x = x0; x < x1; x += 2) fill(g, x, base - 4, 1, 5, "N");
    }
  }
  // 산울타리 정원 (9단계): 문 앞을 비우고 앞줄에
  if (stage >= 9) {
    fill(g, left - 4, base, 12, 1, "H");
    fill(g, 24, base, 12, 1, "H");
  }
  return art(g, {
    W: "#fbeed4",
    w: "#e6d3b0",
    R: roof,
    r: darken(roof),
    C: "#8a5a44",
    c: "#5e3c2c",
    D: "#9a6a3a",
    d: "#7a4a2a",
    K: "#f4d03f",
    G: "#bfe6ff",
    F: "#7a4a2a",
    P: "#8a5a44",
    p: "#ff6b8a",
    q: "#ffd166",
    L: "#ffe28a",
    N: "#b07a4a",
    S: "#ff6b6b",
    B: "#3f8a4e",
    T: "#d8cfc0",
    t: "#b8ad9c",
    Y: "#f4c430",
    H: "#2a7348",
  });
}

/** 글 쓴 집의 불 켜진 유리 (광장 개편 "글 쓴 집에 불이 켜진다"): 낮에도 따뜻한 노랑으로 보인다 */
export const LIT_GLASS = "#ffd56e";
/** 밤·노을·새벽에 덧칠(multiply) 위로 다시 얹는 창 불빛 */
export const LIT_GLOW = "#ffe9a6";

/** 집 그림의 유리 칸('G')만 불 켜진 색으로 바꾼다. 칸 배치는 그대로라 몸체·이름표 자리가 같다 */
export function litHouseArt(house: PixelArt): PixelArt {
  return { rows: house.rows, palette: { ...house.palette, G: LIT_GLASS } };
}

/** 그림에서 글자 `ch` 칸만 남긴 덧칠 그림 (밤에 창·가로등 불빛을 어둠 위에 다시 그린다) */
export function glowCells(source: PixelArt, ch: string, color: string): PixelArt {
  const keep = new RegExp(`[^${ch}]`, "g");
  return { rows: source.rows.map((r) => r.replace(keep, ".")), palette: { [ch]: color } };
}

/** 글자 `ch`가 이어진 덩어리(창 하나)마다 가운데 칸 좌표 (빛 무리 자리) */
export function cellGroups(source: PixelArt, ch: string): { x: number; y: number }[] {
  const seen = new Set<string>();
  const out: { x: number; y: number }[] = [];
  source.rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== ch || seen.has(`${x},${y}`)) return;
      const stack = [[x, y]];
      seen.add(`${x},${y}`);
      let sx = 0;
      let sy = 0;
      let n = 0;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        sx += cx + 0.5;
        sy += cy + 0.5;
        n++;
        for (const [nx, ny] of [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ]) {
          if (source.rows[ny]?.[nx] === ch && !seen.has(`${nx},${ny}`)) {
            seen.add(`${nx},${ny}`);
            stack.push([nx, ny]);
          }
        }
      }
      out.push({ x: sx / n, y: sy / n });
    }),
  );
  return out;
}

/** 굴뚝 꼭대기 가운데 칸 (집 그림의 굴뚝 뚜껑 'c' 줄). 굴뚝이 없으면 null */
export function chimneyTop(house: PixelArt): { x: number; y: number } | null {
  const y = house.rows.findIndex((r) => r.includes("c"));
  if (y < 0) return null;
  const row = house.rows[y];
  return { x: (row.indexOf("c") + row.lastIndexOf("c") + 1) / 2, y };
}

/** 굴뚝 연기 그림 수 (초당 3장으로 돌린다) */
export const SMOKE_FRAMES = 3;

/**
 * 굴뚝 연기 (9×12칸, 아랫변 가운데가 굴뚝 꼭대기): 김 세 덩이가 오른쪽 위로 오르며 커지고 옅어진다.
 * 장마다 덩이가 1/3씩 올라가서 0 → 1 → 2 → 0으로 이어 돌린다.
 */
export function smokeArt(frame: number): PixelArt {
  const g = grid(9, 12);
  const f = ((frame % SMOKE_FRAMES) + SMOKE_FRAMES) % SMOKE_FRAMES;
  for (let i = 0; i < 3; i++) {
    const t = i + f / SMOKE_FRAMES;
    const cx = 3.5 + t * 1.1;
    const cy = 10.5 - t * 3.2;
    const r = 0.8 + t * 0.55;
    const ch = t < 1 ? "S" : t < 2 ? "s" : "f";
    for (let y = 0; y < 12; y++) for (let x = 0; x < 9; x++) if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) g[y][x] = ch;
  }
  return art(g, { S: "#e6dfd4", s: "#f0ebe3", f: "#f8f5f0" });
}

/** 빈 집터: 점선 집터와 말뚝 팻말 */
export function emptyLotArt(): PixelArt {
  const g = grid(30, 22);
  for (let x = 1; x < 29; x += 2) {
    g[6][x] = "L";
    g[21][x] = "L";
  }
  for (let y = 6; y < 22; y += 2) {
    g[y][1] = "L";
    g[y][28] = "L";
  }
  fill(g, 4, 0, 10, 6, "N");
  frame(g, 4, 0, 10, 6, "n");
  fill(g, 8, 6, 2, 6, "n");
  return art(g, { L: "#e8dcc0", N: "#d9b48a", n: "#8a5a34" });
}

/** 게시판 쪽지 자리 (왼쪽 코르크판): 앞의 셋이 예전 그림이고, 넷째·다섯째는 위에 겹쳐 붙인다 */
const BOARD_PAPERS: readonly { x: number; y: number; w: number; h: number; ch: string; pin: [number, number] }[] = [
  { x: 5, y: 6, w: 7, h: 6, ch: "W", pin: [8, 6] },
  { x: 14, y: 7, w: 8, h: 5, ch: "Y", pin: [17, 7] },
  { x: 7, y: 14, w: 9, h: 6, ch: "W", pin: [11, 14] },
  { x: 17, y: 13, w: 5, h: 6, ch: "Q", pin: [19, 13] },
  { x: 13, y: 10, w: 5, h: 4, ch: "B", pin: [15, 10] },
];
/** 게시판 쪽지는 5장, 출석 도장 칸은 7칸까지 */
export const BOARD_MAX = { papers: BOARD_PAPERS.length, stamps: 7 } as const;

/**
 * 마을 게시판: 왼쪽은 마을 소식 코르크판, 오른쪽은 출석 도장 칸 (살아 있는 게시판, 광장 개편).
 * `papers`는 오늘 새 글 쪽지 수(0~5), `stamps`는 이번 주 출석 도장 수(0~7). 기본 (3, 3)은 예전 그림과 같다.
 */
export function boardArt(papers = 3, stamps = 3): PixelArt {
  const notes = BOARD_PAPERS.slice(0, Math.max(0, Math.min(BOARD_MAX.papers, Math.floor(papers))));
  const stamped = Math.max(0, Math.min(BOARD_MAX.stamps, Math.floor(stamps)));
  const g = grid(50, 34);
  fill(g, 4, 20, 2, 14, "N");
  fill(g, 44, 20, 2, 14, "N");
  fill(g, 1, 2, 48, 22, "F");
  fill(g, 0, 0, 50, 3, "R");
  fill(g, 3, 4, 21, 18, "K");
  fill(g, 26, 4, 21, 18, "P");
  // 소식 종이와 압정
  for (const n of notes) fill(g, n.x, n.y, n.w, n.h, n.ch);
  for (const n of notes) g[n.pin[1]][n.pin[0]] = "r";
  // 도장 칸 7개
  for (let i = 0; i < BOARD_MAX.stamps; i++) {
    const x = 28 + (i % 4) * 5;
    const y = 6 + Math.floor(i / 4) * 7;
    frame(g, x, y, 4, 4, "n");
    if (i < stamped) fill(g, x + 1, y + 1, 2, 2, "r");
  }
  return art(g, {
    N: "#7a4a2a",
    F: "#9a6a3a",
    R: "#6b4226",
    K: "#c9935a",
    P: "#fbeed4",
    W: "#ffffff",
    Y: "#fff3a0",
    r: "#e74c3c",
    n: "#b07a4a",
    // 넷째·다섯째 쪽지가 있을 때만 (기본 그림의 팔레트는 예전 그대로)
    ...(notes.length > 3 ? { Q: "#ffd6e0" } : {}),
    ...(notes.length > 4 ? { B: "#d8ecff" } : {}),
  });
}

/** 상점: 줄무늬 차양, 동전 간판, 진열창, 문 */
export function shopArt(): PixelArt {
  const g = grid(42, 36);
  fill(g, 3, 12, 36, 24, "W");
  fill(g, 3, 12, 1, 24, "w");
  fill(g, 1, 8, 40, 2, "R");
  for (let x = 1; x < 41; x += 4) fill(g, x, 10, 2, 4, "R");
  for (let x = 3; x < 41; x += 4) fill(g, x, 10, 2, 4, "V");
  // 동전 간판
  fill(g, 16, 1, 10, 7, "Y");
  frame(g, 16, 1, 10, 7, "y");
  fill(g, 20, 3, 2, 3, "y");
  // 진열창
  frame(g, 6, 17, 14, 10, "F");
  fill(g, 7, 18, 12, 8, "G");
  fill(g, 9, 22, 3, 3, "p");
  fill(g, 14, 21, 3, 4, "q");
  // 문
  fill(g, 26, 20, 8, 16, "D");
  fill(g, 27, 22, 6, 4, "G");
  g[29][32] = "Y";
  return art(g, {
    W: "#fff6e5",
    w: "#e8d9bf",
    R: "#e74c3c",
    V: "#ffffff",
    Y: "#f4c430",
    y: "#b8860b",
    F: "#7a4a2a",
    G: "#bfe6ff",
    D: "#9a6a3a",
    p: "#ff6b8a",
    q: "#7bc96f",
  });
}

/** 동물 농장 (TOWN-09): 빨간 헛간(흰 X 문, 둥근 창)과 왼쪽 나무 울타리, 건초 더미 */
export function farmArt(): PixelArt {
  const g = grid(44, 34);
  // 헛간 벽
  fill(g, 12, 13, 28, 21, "R");
  fill(g, 12, 13, 1, 21, "r");
  fill(g, 39, 13, 1, 21, "r");
  // 지붕 (박공)
  gable(g, 26, 1, 12, "B", "b");
  // 둥근 창 (건초)
  fill(g, 24, 7, 4, 4, "W");
  fill(g, 25, 8, 2, 2, "H");
  // 문: 흰 테두리 + X
  fill(g, 20, 20, 12, 14, "D");
  frame(g, 20, 20, 12, 14, "W");
  for (let i = 0; i < 12; i++) {
    const y = 20 + Math.round((i * 13) / 11);
    g[y][20 + i] = "W";
    g[y][31 - i] = "W";
  }
  // 울타리
  for (let x = 0; x < 12; x += 3) fill(g, x, 24, 1, 10, "F");
  fill(g, 0, 26, 12, 1, "f");
  fill(g, 0, 30, 12, 1, "f");
  // 건초 더미
  fill(g, 40, 28, 4, 6, "H");
  fill(g, 41, 27, 2, 1, "H");
  fill(g, 40, 30, 4, 1, "h");
  return art(g, {
    R: "#c0392b",
    r: "#922b21",
    B: "#6e4b3a",
    b: "#4a3226",
    W: "#fdf6e3",
    H: "#f4d35e",
    h: "#c9a227",
    D: "#a93226",
    F: "#a0703c",
    f: "#c48a4a",
  });
}

/** 연못 그림 수: 물결과 찌가 두 장으로 흔들린다 */
export const POND_FRAMES = 2;

/** 연못 낚시터 (TOWN-14): 둥근 연못, 연잎, 앞쪽 나무 잔교와 낚싯대. `frame` 1은 물결이 한 칸 옮겨 가고 찌 둘레에 동그란 물결 */
export function pondArt(frame = 0): PixelArt {
  const moved = frame % POND_FRAMES === 1;
  const g = grid(40, 22);
  // 연못 (타원): 가장자리 돌 → 물
  for (let y = 0; y < 18; y++) {
    const t = (y - 8.5) / 9;
    const half = Math.round(19.5 * Math.sqrt(Math.max(0, 1 - t * t)));
    fill(g, 20 - half, y + 2, half * 2, 1, "S");
    if (half > 1) fill(g, 21 - half, y + 2, half * 2 - 2, 1, y < 4 ? "L" : "W");
  }
  // 물결
  if (moved) {
    fill(g, 9, 9, 3, 1, "L");
    fill(g, 25, 12, 4, 1, "L");
    fill(g, 15, 15, 3, 1, "L");
  } else {
    fill(g, 8, 9, 4, 1, "L");
    fill(g, 26, 12, 5, 1, "L");
    fill(g, 14, 15, 3, 1, "L");
  }
  // 연잎과 꽃
  fill(g, 6, 13, 3, 2, "G");
  fill(g, 30, 7, 3, 2, "G");
  g[7][31] = "P";
  fill(g, 22, 6, 2, 2, "G");
  // 잔교 (앞쪽 가운데)
  fill(g, 17, 14, 6, 8, "D");
  for (let y = 15; y < 22; y += 2) fill(g, 17, y, 6, 1, "d");
  fill(g, 17, 14, 1, 8, "d");
  fill(g, 22, 14, 1, 8, "d");
  // 낚싯대와 찌
  for (let i = 0; i < 6; i++) g[13 - i][23 + i] = "R";
  fill(g, 29, 8, 1, moved ? 3 : 2, "n");
  g[11][29] = "F";
  if (moved) {
    g[11][28] = "L";
    g[11][30] = "L";
    g[12][29] = "L";
  }
  return art(g, {
    S: "#9a9a8a",
    W: "#4aa3df",
    L: "#8fd0f5",
    G: "#5fae4f",
    P: "#ff8fb1",
    D: "#b07c4a",
    d: "#7a5230",
    R: "#5a3b22",
    n: "#e8e8e8",
    F: "#e74c3c",
  });
}

/** 분수 그림 수: 물줄기 물빛과 수반 물결이 세 장으로 돈다 */
export const FOUNTAIN_FRAMES = 3;

/**
 * 3단 분수: 큰 돌 수반 위에 가운데 접시와 꼭대기 접시. 꼭대기에서 솟은 물이 접시 가장자리로 넘쳐 아래 단으로 흐른다.
 * `frame`(0~2)마다 물줄기의 밝은 칸이 한 칸씩 내려가고, 수반 물결 고리가 기둥에서 바깥으로 퍼진다. 크기(30×22칸)는 늘 같다.
 */
export function fountainArt(frame = 0): PixelArt {
  const f = ((frame % FOUNTAIN_FRAMES) + FOUNTAIN_FRAMES) % FOUNTAIN_FRAMES;
  const g = grid(30, 22);
  // 수반 (타원)
  for (let y = 0; y < 10; y++) {
    const t = (y - 4.5) / 5;
    const half = Math.round(15 * Math.sqrt(Math.max(0, 1 - t * t)));
    fill(g, 15 - half, 12 + y, half * 2, 1, "S");
  }
  for (let y = 1; y < 8; y++) {
    const t = (y - 4.5) / 4;
    const half = Math.round(12 * Math.sqrt(Math.max(0, 1 - t * t)));
    fill(g, 15 - half, 12 + y, half * 2, 1, "B");
  }
  // 수반 물결: 기둥 밑에서 바깥으로 퍼지는 고리 (가로로 납작한 타원)
  const ring = 3 + f * 2.5;
  for (let y = 13; y < 20; y++) {
    for (let x = 0; x < 30; x++) {
      if (g[y][x] !== "B") continue;
      const d = Math.hypot((x + 0.5 - 15) / 2, y + 0.5 - 15.5);
      if (Math.abs(d * 2 - ring) < 0.6) g[y][x] = "v";
    }
  }
  // 가운데 기둥
  fill(g, 14, 3, 2, 13, "s");
  // 가운데 접시 (둘째 단)
  fill(g, 10, 6, 10, 2, "S");
  fill(g, 11, 6, 8, 1, "B");
  fill(g, 11, 8, 8, 1, "s");
  // 꼭대기 접시 (셋째 단)
  fill(g, 12, 2, 6, 2, "S");
  fill(g, 13, 2, 4, 1, "B");
  fill(g, 13, 4, 4, 1, "s");
  // 솟는 물과 넘쳐 흐르는 물줄기: 밝은 칸(w)과 옅은 칸(v)이 장마다 한 칸씩 내려간다
  const flow = (x: number, top: number, rows: number) => {
    for (let r = 0; r < rows; r++) g[top + r][x] = (r + 3 - f) % 3 === 0 ? "v" : "w";
  };
  flow(14, 0, 2);
  flow(15, 0, 2);
  if (f === 1) g[0][13] = g[0][16] = "v";
  flow(11, 3, 3);
  flow(18, 3, 3);
  flow(9, 7, 6);
  flow(20, 7, 6);
  return art(g, { S: "#c9c2b5", s: "#a39b8c", B: "#6ec6ff", w: "#d6f0ff", v: "#a6dcfb" });
}

/** 집 앞 우체통 (TOWN-13): 내 집은 파랑, 다른 집은 빨강. `flag`면 안 읽은 알림 깃발을 올린다 */
export function mailboxArt(mine: boolean, flag = false): PixelArt {
  const g = grid(9, 12);
  // 둥근 지붕 통
  fill(g, 1, 1, 6, 1, "K");
  fill(g, 0, 2, 8, 4, "B");
  fill(g, 1, 1, 6, 1, "B");
  frame(g, 0, 2, 8, 4, "K");
  fill(g, 1, 0, 6, 1, "K");
  fill(g, 2, 3, 4, 1, "K");
  // 기둥과 밑동
  fill(g, 3, 6, 2, 5, "P");
  fill(g, 2, 11, 4, 1, "P");
  // 깃발: 내려가 있으면 옆에 붙고, 올라가면 위로
  if (flag) {
    fill(g, 8, 0, 1, 4, "K");
    fill(g, 7, 0, 1, 2, "F");
  } else fill(g, 8, 3, 1, 2, "F");
  return art(g, { K: "#2b2b2b", B: mine ? "#3a6ea5" : "#b8452f", P: "#6b4a2f", F: "#ffd23f" });
}

/** 전망대 나무 의자 (TOWN-05) */
export function benchArt(): PixelArt {
  const g = grid(18, 8);
  fill(g, 0, 0, 18, 2, "W");
  fill(g, 0, 3, 18, 2, "W");
  fill(g, 0, 2, 18, 1, "w");
  fill(g, 0, 5, 18, 1, "w");
  fill(g, 1, 6, 2, 2, "N");
  fill(g, 15, 6, 2, 2, "N");
  return art(g, { W: "#b07a4a", w: "#8a5a34", N: "#5a3d26" });
}

/** 마을 초록 (광장 개편 2): 브랜드 초록 #2a7348을 그늘로 쓰는 잎 팔레트 두 가지 */
const LEAF = [
  { L: "#3f8a4e", D: "#2a7348", d: "#1f5537", H: "#7fbf6a" },
  { L: "#5a9a3e", D: "#3d7a34", d: "#2b5c27", H: "#8cc46a" },
] as const;
/** 가을 잎: 단풍과 은행 */
const MAPLE = { L: "#d9692e", D: "#b04a22", d: "#86361a", H: "#f0a050" } as const;
const GINKGO = { L: "#e9b341", D: "#c98f24", d: "#9a6a1c", H: "#f7dc7a" } as const;
const TRUNK = { N: "#6b4a2f", n: "#4e3522" } as const;
/** 눈 (겨울 지붕·울타리·나무 위) */
export const SNOW = { Z: "#f4f7fb", z: "#d5dfea" } as const;

/** 나무 모양 (12×16칸): 둥근 잎 덩어리(L), 아래 왼쪽 그늘(D), 맨 아래 가장자리 깊은 그늘(d), 밝은 잎(H), 둥치(N·n) */
function treeShape(): Grid {
  const g = grid(12, 16);
  fill(g, 5, 10, 2, 6, "N");
  fill(g, 6, 11, 1, 5, "n");
  const half = (y: number) => Math.round(6 * Math.sqrt(Math.max(0, 1 - ((y - 5) / 5.5) ** 2)));
  for (let y = 0; y < 11; y++) fill(g, 6 - half(y), y, half(y) * 2, 1, "L");
  for (let y = 6; y < 11; y++) fill(g, 6 - half(y), y, Math.max(1, half(y) - 1), 1, "D");
  // 깊은 그늘: 잎 덩어리 아랫줄과 왼쪽 끝 칸
  for (let y = 7; y < 11; y++) g[y][6 - half(y)] = "d";
  fill(g, 6 - half(10) + 1, 10, Math.max(1, half(10) * 2 - 3), 1, "d");
  g[3][4] = "H";
  g[4][7] = "H";
  g[2][6] = "H";
  return g;
}

/**
 * 숲 나무 (광장 개편 2, 계절): `variant` 0·1은 마을 초록 두 가지. 계절이 가을이면 4그루에 하나는 단풍, 하나는 은행,
 * 겨울이면 잎 위에 눈이 얹힌다. 봄은 초록 잎에 연분홍 꽃 몇 점. 기본(`summer`)은 초록 그대로.
 */
export function treeArt(variant: number, season: Season = "summer"): PixelArt {
  const g = treeShape();
  const v = ((variant % 4) + 4) % 4;
  if (season === "autumn" && (v === 1 || v === 2)) return art(g, { ...TRUNK, ...(v === 1 ? MAPLE : GINKGO) });
  const leaf = LEAF[v % 2];
  if (season === "winter") {
    // 잎 덩어리 맨 위 두 줄과 밝은 잎 자리에 눈
    for (let x = 0; x < 12; x++) {
      const top = g.findIndex((row) => row[x] === "L" || row[x] === "H");
      if (top < 0 || top > 9) continue;
      g[top][x] = "Z";
      if (x % 2 === 0 && g[top + 1]?.[x] === "L") g[top + 1][x] = "z";
    }
    return art(g, { ...TRUNK, ...leaf, L: darken(leaf.L, 0.12), ...SNOW });
  }
  if (season === "spring") {
    for (const [x, y] of [
      [3, 2],
      [8, 3],
      [5, 5],
      [9, 7],
    ])
      g[y][x] = "P";
    return art(g, { ...TRUNK, ...leaf, P: "#ffd0dc" });
  }
  return art(g, { ...TRUNK, ...leaf });
}

/** 감나무 (가을, 광장 개편 2): 누렇게 물든 성긴 잎에 주황 감이 주렁주렁 */
export function persimmonTreeArt(): PixelArt {
  const g = treeShape();
  // 잎을 군데군데 비워 성기게
  for (const [x, y] of [
    [2, 4],
    [9, 3],
    [1, 7],
    [10, 8],
    [4, 1],
  ])
    g[y][x] = ".";
  for (const [x, y] of [
    [3, 3],
    [8, 2],
    [6, 5],
    [2, 8],
    [9, 6],
    [5, 8],
    [8, 9],
  ]) {
    g[y][x] = "O";
    if (g[y - 1]?.[x] && g[y - 1][x] !== ".") g[y - 1][x] = "o";
  }
  return art(g, { ...TRUNK, L: "#a8923a", D: "#86742c", d: "#5f5320", H: "#c9b24e", O: "#e8762c", o: "#5a3d26" });
}

/**
 * 그림 위에 눈을 얹는다 (겨울, 광장 개편 2): 칸마다 맨 위 칠한 칸을 눈으로, 짝수 칸은 그 아래 한 칸까지 눈 그늘.
 * 칸 배치(크기)는 그대로라 몸체·이름표 자리가 같다. `only`를 주면 그 글자 칸에만 얹는다 (집은 지붕·굴뚝만).
 */
export function snowCap(source: PixelArt, only?: string): PixelArt {
  const rows = source.rows.map((r) => [...r]);
  const painted = (ch: string | undefined) => ch !== undefined && ch !== "." && Boolean(source.palette[ch]);
  const width = rows[0]?.length ?? 0;
  for (let x = 0; x < width; x++) {
    const top = rows.findIndex((row) => painted(row[x]));
    if (top < 0 || (only && !only.includes(rows[top][x]))) continue;
    rows[top][x] = "Z";
    if (x % 2 === 0 && painted(rows[top + 1]?.[x]) && (!only || only.includes(rows[top + 1][x]))) rows[top + 1][x] = "z";
  }
  return { rows: rows.map((r) => r.join("")), palette: { ...source.palette, ...SNOW } };
}

/** 광장 가로등. 켜면(`lit`, 노을·밤·새벽) 노란 등, 끄면(낮) 흐린 유리. 기본은 예전 그림(켠 등) */
export function lampArt(lit = true): PixelArt {
  const g = grid(6, 22);
  fill(g, 2, 4, 2, 18, "N");
  fill(g, 0, 21, 6, 1, "N");
  fill(g, 1, 0, 4, 4, "L");
  frame(g, 1, 0, 4, 4, "n");
  return art(g, { N: "#4a4a4a", n: "#2b2b2b", L: lit ? "#ffe28a" : "#d5dde0" });
}

// 내 정원 (TOWN-20, specs/053-garden)
const FENCE = { W: "#fdfdf8", w: "#cfcfc4", K: "#8f8f84" };

/** 흰 울타리 한 칸 (가로, 8칸 = 40px): 뾰족한 말뚝 둘과 가로대 두 줄 */
export function fenceArt(): PixelArt {
  const g = grid(8, 8);
  for (const x of [1, 5]) {
    g[0][x] = "W";
    fill(g, x - 1, 1, 3, 7, "W");
    fill(g, x + 1, 1, 1, 7, "w");
  }
  fill(g, 0, 3, 8, 1, "W");
  fill(g, 0, 4, 8, 1, "w");
  fill(g, 0, 6, 8, 1, "W");
  fill(g, 0, 7, 8, 1, "K");
  return art(g, FENCE);
}

/** 옆 울타리 말뚝 (위에서 비스듬히 본 세로 줄, 4칸 = 20px마다 하나) */
export function fencePostArt(): PixelArt {
  const g = grid(3, 8);
  g[0][1] = "W";
  fill(g, 0, 1, 3, 7, "W");
  fill(g, 2, 1, 1, 7, "w");
  fill(g, 0, 7, 3, 1, "K");
  return art(g, FENCE);
}

/** 장미 아치 문 (20칸 = 100px): 흰 기둥 둘과 둥근 아치를 덮은 덩굴장미 */
export function rosesArchArt(): PixelArt {
  const g = grid(20, 26);
  // 기둥
  fill(g, 0, 8, 2, 18, "W");
  fill(g, 18, 8, 2, 18, "W");
  fill(g, 1, 8, 1, 18, "w");
  fill(g, 19, 8, 1, 18, "w");
  // 아치 (반원 띠)
  for (let x = 0; x < 20; x++) {
    const t = (x - 9.5) / 10;
    const top = Math.round(8 - 7 * Math.sqrt(Math.max(0, 1 - t * t)));
    fill(g, x, top, 1, 3, "W");
  }
  // 덩굴 잎과 장미
  for (let x = 0; x < 20; x++) {
    const t = (x - 9.5) / 10;
    const top = Math.round(8 - 7 * Math.sqrt(Math.max(0, 1 - t * t)));
    g[top][x] = x % 2 === 0 ? "L" : "G";
    if (x % 3 === 1) g[top + 1][x] = "R";
    if (x % 4 === 2) g[Math.max(0, top - 1)][x] = "P";
  }
  for (let y = 10; y < 24; y += 3) {
    g[y][0] = "G";
    g[y + 1][1] = "R";
    g[y][19] = "G";
    g[y + 1][18] = "P";
  }
  fill(g, 0, 25, 2, 1, "K");
  fill(g, 18, 25, 2, 1, "K");
  return art(g, { ...FENCE, G: "#3e8e41", L: "#5cb85c", R: "#e63964", P: "#ff8fb1" });
}

/** 꽃밭 (12칸 = 60px): 흙 테두리 안에 빨강·노랑·분홍·보라 꽃 */
export function flowerBedArt(variant: number): PixelArt {
  const g = grid(12, 6);
  fill(g, 0, 1, 12, 5, "E");
  fill(g, 1, 2, 10, 3, "e");
  const colors = variant % 2 === 0 ? ["R", "Y", "P", "V"] : ["P", "V", "Y", "R"];
  for (let x = 1; x < 11; x += 2) {
    const ch = colors[(x >> 1) % colors.length];
    g[1][x] = ch;
    g[2][x] = "G";
    g[3][x + 1 < 11 ? x + 1 : x] = colors[((x >> 1) + 2) % colors.length];
  }
  return art(g, { E: "#8a5a34", e: "#6b4426", G: "#3e8e41", R: "#e74c3c", Y: "#ffd23f", P: "#ff8fb1", V: "#b39ddb" });
}

/**
 * 정원 벚나무 (광장 개편 2, 계절): 봄에만 분홍 꽃, 여름은 초록 잎, 가을은 붉게 물들고, 겨울은 앙상한 가지에 눈.
 * 기본(`spring`)은 예전 그림(분홍)과 같다.
 */
export function cherryTreeArt(season: Season = "spring"): PixelArt {
  const g = grid(14, 18);
  fill(g, 6, 11, 2, 7, "N");
  g[12][5] = "N";
  g[11][8] = "N";
  if (season === "winter") {
    // 앙상한 가지: 둥치에서 위로 갈라지는 가지와 잔가지, 가지 위에 눈
    const branches: [number, number][] = [
      [6, 10], [5, 9], [4, 8], [3, 7], [2, 6], [3, 5],
      [7, 10], [8, 9], [9, 8], [10, 7], [11, 6], [10, 5],
      [6, 9], [6, 8], [7, 7], [7, 6], [6, 5], [6, 4], [7, 3],
      [4, 6], [5, 5], [9, 6], [8, 5], [8, 4],
    ];
    for (const [x, y] of branches) g[y][x] = "N";
    for (const [x, y] of [
      [2, 5], [3, 4], [10, 4], [11, 5], [6, 3], [7, 2], [8, 3], [5, 4], [4, 7], [9, 7],
    ])
      g[y][x] = "Z";
    return art(g, { N: "#6b4226", ...SNOW });
  }
  for (let y = 0; y < 13; y++) {
    const t = (y - 6) / 6.5;
    const half = Math.round(7 * Math.sqrt(Math.max(0, 1 - t * t)));
    fill(g, 7 - half, y, half * 2, 1, "L");
  }
  for (let y = 7; y < 13; y++) {
    const t = (y - 6) / 6.5;
    const half = Math.round(7 * Math.sqrt(Math.max(0, 1 - t * t)));
    fill(g, 7 - half, y, Math.max(1, half - 1), 1, "D");
  }
  for (const [x, y] of [
    [4, 3],
    [9, 2],
    [6, 6],
    [11, 7],
    [3, 9],
  ])
    g[y][x] = "H";
  const leaves: Record<Exclude<Season, "winter">, Record<string, string>> = {
    spring: { L: "#ffb7c5", D: "#f48fb1", H: "#fff0f5" },
    summer: { L: "#5a9a3e", D: "#3d7a34", H: "#8cc46a" },
    autumn: { L: "#c8542c", D: "#9a3b22", H: "#e9b341" },
  };
  return art(g, { N: "#6b4226", ...leaves[season] });
}

// 광장 가게 건물 (SHOP-07·08, specs/053-garden)

/** 꼬까 옷가게: 분홍 벽, 옷걸이 간판, 원피스가 걸린 진열창 */
export function clothesShopArt(): PixelArt {
  const g = grid(30, 30);
  fill(g, 2, 10, 26, 20, "W");
  fill(g, 2, 10, 1, 20, "w");
  // 지붕
  fill(g, 0, 7, 30, 3, "R");
  for (let x = 0; x < 30; x += 3) g[9][x] = "r";
  // 옷걸이 간판
  fill(g, 10, 0, 10, 7, "S");
  frame(g, 10, 0, 10, 7, "K");
  g[1][15] = "K";
  fill(g, 13, 2, 5, 1, "K");
  g[3][12] = "K";
  g[3][18] = "K";
  fill(g, 12, 4, 7, 1, "K");
  // 진열창과 원피스
  frame(g, 4, 14, 11, 10, "F");
  fill(g, 5, 15, 9, 8, "G");
  fill(g, 8, 16, 3, 2, "P");
  fill(g, 7, 18, 5, 4, "P");
  // 문
  fill(g, 18, 16, 7, 14, "D");
  fill(g, 19, 18, 5, 4, "G");
  g[23][23] = "Y";
  return art(g, { W: "#ffe4ec", w: "#f3c6d3", R: "#d6336c", r: "#a61e4d", S: "#fff9db", K: "#5c3d2e", F: "#7a4a2a", G: "#bfe6ff", P: "#9b59b6", D: "#c2255c", Y: "#f4c430" });
}

/** 반짝 미용실: 민트 벽, 가위 간판, 빨강·흰 줄무늬 기둥 */
export function salonArt(): PixelArt {
  const g = grid(30, 30);
  fill(g, 2, 10, 26, 20, "W");
  fill(g, 2, 10, 1, 20, "w");
  fill(g, 0, 7, 30, 3, "B");
  for (let x = 1; x < 30; x += 3) g[9][x] = "b";
  // 가위 간판
  fill(g, 10, 0, 10, 7, "S");
  frame(g, 10, 0, 10, 7, "K");
  for (let i = 0; i < 4; i++) {
    g[1 + i][12 + i] = "K";
    g[1 + i][17 - i] = "K";
  }
  g[5][12] = "R";
  g[5][17] = "R";
  // 줄무늬 기둥
  for (let y = 12; y < 28; y++) g[y][4] = g[y][5] = (y >> 1) % 2 === 0 ? "R" : "V";
  fill(g, 3, 11, 4, 1, "K");
  fill(g, 3, 28, 4, 1, "K");
  // 진열창 (거울)
  frame(g, 8, 14, 9, 9, "F");
  fill(g, 9, 15, 7, 7, "G");
  fill(g, 10, 16, 2, 4, "L");
  // 문
  fill(g, 19, 16, 7, 14, "D");
  fill(g, 20, 18, 5, 4, "G");
  g[23][24] = "Y";
  return art(g, { W: "#e3fafc", w: "#b2f2bb", B: "#12b886", b: "#087f5b", S: "#fff9db", K: "#343a40", R: "#e03131", V: "#ffffff", F: "#7a4a2a", G: "#bfe6ff", L: "#ffffff", D: "#0ca678", Y: "#f4c430" });
}

// 청사초롱 줄등 (광장 개편 2 대표 장면): 붉은 윗단·푸른 아랫단, 금빛 테와 술, 먹 외곽
/** 초롱 색: 켜면 속이 노랗게(`LIT_GLASS`) 빛나고, 끄면 붉은·푸른 비단이 회색으로 가라앉는다 */
export const LANTERN = {
  red: "#c8342c",
  blue: "#2f4a8f",
  gold: "#e9b341",
  ink: "#3b2a20",
  offRed: "#8c7f74",
  offBlue: "#6f7690",
} as const;

/** 초롱 크기마다 칸 그림: `s` 처마 초롱 5×8, `m` 줄등 초롱 7×11, `l` 장대 꼭대기 내 초롱 9×13. `J`는 촛불 심지, `r`·`b`는 안에서 비치는 비단 */
const LANTERN_ROWS: Record<"s" | "m" | "l", readonly string[]> = {
  s: ["..K..", "KYYYK", "KRJRK", "KRJRK", "KBJBK", "KBBBK", ".KYK.", "..Y.."],
  m: ["...K...", ".KYYYK.", "KRRRRRK", "KRrJrRK", "KRrJrRK", "KBbJbBK", "KBbJbBK", "KBBBBBK", ".KYYYK.", "...Y...", "..YYY.."],
  l: [
    "....K....",
    "..KYYYK..",
    ".KRRRRRK.",
    "KRRrrrRRK",
    "KRrrJrrRK",
    "KRrrJrrRK",
    "KBbbJbbBK",
    "KBbbJbbBK",
    "KBBbbbBBK",
    ".KBBBBBK.",
    "..KYYYK..",
    "...YYY...",
    "...Y.Y...",
  ],
};

/**
 * 청사초롱 (광장 개편 2): 즐겨찾는 이웃 한 명에 하나씩 광장 줄등에 달린다. `lit`이면 가운데 심지(`J`)가 노랗게(#ffd56e) 켜지고
 * 붉은·푸른 비단이 안에서 밝게 비친다. 끄면 비단이 회색으로 가라앉는다.
 * `s` 처마 초롱(5×8칸), `m` 줄등 초롱(7×11칸), `l` 장대 꼭대기 내 초롱(9×13칸). 매다는 곳은 맨 윗줄 가운데 칸.
 */
export function lanternArt(lit: boolean, size: "s" | "m" | "l"): PixelArt {
  const g = LANTERN_ROWS[size].map((r) => [...r]);
  return art(g, {
    K: LANTERN.ink,
    Y: lit ? LANTERN.gold : "#a8946a",
    R: lit ? LANTERN.red : LANTERN.offRed,
    B: lit ? LANTERN.blue : LANTERN.offBlue,
    r: lit ? "#e8553f" : LANTERN.offRed,
    b: lit ? "#4a6fc0" : LANTERN.offBlue,
    J: lit ? LIT_GLASS : "#7a6e64",
  });
}

/** 줄등 장대 (광장 개편 2): 분수 뒤에 선 나무 장대 4×28칸. 맨 위 가로대에 줄 네 가닥을 묶는다 */
export function mastArt(): PixelArt {
  const g = grid(4, 28);
  fill(g, 1, 1, 2, 27, "N");
  fill(g, 2, 1, 1, 27, "n");
  // 가로대와 꼭지
  fill(g, 0, 2, 4, 1, "n");
  fill(g, 1, 0, 2, 1, "n");
  // 밑동 받침
  fill(g, 0, 26, 4, 2, "n");
  fill(g, 0, 26, 2, 1, "N");
  return art(g, { N: "#8a5a34", n: "#5a3d26" });
}

/** 오늘 할 일 표시 (광장 개편 2): 압정(붉은 점)으로 꽂은 종이 쪽지에 먹 '!' (7×10칸) */
export function markerArt(): PixelArt {
  const g = grid(7, 10);
  fill(g, 1, 1, 5, 1, "K");
  fill(g, 0, 2, 7, 7, "K");
  fill(g, 1, 9, 5, 1, "K");
  fill(g, 1, 2, 5, 7, "P");
  fill(g, 3, 3, 1, 3, "K");
  g[7][3] = "K";
  // 쪽지 오른쪽 아래 그늘과 압정
  fill(g, 5, 3, 1, 6, "p");
  g[0][3] = "R";
  g[1][3] = "R";
  return art(g, { K: "#3b2a20", P: "#fbf1dc", p: "#eadbbd", R: "#c8342c" });
}

/** 불꽃 튀는 순간 (내 초롱 켜기·할 일 다 함) 장 수 */
export const SPARK_FRAMES = 4;

/** 초롱 불꽃 (11×11칸): 가운데에서 금빛 점이 열십자·대각으로 퍼졌다가 사라진다 */
export function sparkArt(frame: number): PixelArt {
  const g = grid(11, 11);
  const f = Math.max(0, Math.min(SPARK_FRAMES - 1, Math.floor(frame)));
  const r = f + 1;
  const put = (x: number, y: number, ch: string) => {
    if (y >= 0 && y < 11 && x >= 0 && x < 11) g[y][x] = ch;
  };
  if (f < 2) {
    put(5, 5, "W");
    put(4, 5, "Y");
    put(6, 5, "Y");
    put(5, 4, "Y");
    put(5, 6, "Y");
  }
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    put(5 + dx * (r + 1), 5 + dy * (r + 1), f < 3 ? "W" : "Y");
    put(5 + dx * r, 5 + dy * r, "Y");
  }
  const d = Math.round(r * 0.8);
  for (const [dx, dy] of [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ])
    put(5 + dx * d, 5 + dy * d, f < 3 ? "O" : "Y");
  return art(g, { W: "#fff8e0", Y: "#ffd56e", O: "#e9b341" });
}

/** 처마 초롱(5×8칸)을 매다는 칸: 집 그림 지붕 처마 오른쪽 끝 바로 아래 (매다는 칸 = 초롱 맨 윗줄 가운데) */
export function eaveHook(house: PixelArt): { x: number; y: number } {
  // 지붕 처마는 지붕 줄(`r`)이 가장 넓은 맨 아랫줄
  let eave = 0;
  let width = 0;
  house.rows.forEach((row, y) => {
    const n = [...row].filter((c) => c === "r").length;
    if (n >= width) {
      width = n;
      eave = y;
    }
  });
  return { x: house.rows[eave].lastIndexOf("r") + 1, y: eave + 1 };
}

/**
 * 글 쓴 집 처마 끝에 소형 초롱을 매단 그림 (광장 개편 2). 칸 배치는 같은 크기 안에서 바꿔 몸체·이름표 자리가 같다.
 * 초롱 속은 'J' 칸이라 밤에 창(`G`)처럼 다시 얹어 빛낸다.
 */
export function withEaveLantern(house: PixelArt): PixelArt {
  const hook = eaveHook(house);
  const lantern = LANTERN_ROWS.s;
  const rows = house.rows.map((r) => [...r]);
  const left = hook.x - 2;
  lantern.forEach((line, dy) =>
    [...line].forEach((ch, dx) => {
      const row = rows[hook.y + dy];
      if (ch === "." || !row || left + dx < 0 || left + dx >= row.length) return;
      row[left + dx] = { K: "k", Y: "y", R: "M", B: "U", J: "J" }[ch]!;
    }),
  );
  return {
    rows: rows.map((r) => r.join("")),
    palette: { ...house.palette, k: LANTERN.ink, y: LANTERN.gold, M: LANTERN.red, U: LANTERN.blue, J: LIT_GLASS },
  };
}

/**
 * 이사 올 이웃의 흐린 집 (광장 개편 2): 그 단계 집 모양을 바랜 색으로, 꺼진 창, 둘레는 점선.
 * 화면에서는 반투명(0.55)으로 그린다. `roof`는 지붕 색 (추천 이웃은 회색, 방문자의 내 집 자리는 그날의 지붕색).
 */
export function ghostHouseArt(stage = 0, roof = "#a9a49c"): PixelArt {
  const house = houseArt(Math.max(1, stage), roof);
  const rows = house.rows.map((r) => [...r]);
  const h = rows.length;
  const w = rows[0].length;
  const painted = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && house.rows[y][x] !== ".";
  // 점선 외곽: 칠한 칸에 붙은 빈 칸을 한 칸 걸러 하나씩
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (painted(x, y) || (x + y) % 3 === 0) continue;
      if (painted(x - 1, y) || painted(x + 1, y) || painted(x, y - 1) || painted(x, y + 1)) rows[y][x] = "O";
    }
  return {
    rows: rows.map((r) => r.join("")),
    palette: {
      ...house.palette,
      W: "#f3ecdf",
      w: "#ddd3c3",
      G: "#8e98a3",
      D: "#b9a68e",
      d: "#a08c74",
      K: "#cfc3ad",
      p: "#c9b2ae",
      q: "#d6c9a6",
      L: "#cfc3ad",
      S: "#c9b2ae",
      B: "#8fae8f",
      H: "#8fae8f",
      O: "#6f665c",
    },
  };
}
