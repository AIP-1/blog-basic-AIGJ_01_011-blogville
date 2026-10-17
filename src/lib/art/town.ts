// 마을 그림 (TOWN-03·04·11, specs/038-town). 캐릭터와 같은 도트 글자 그림을 코드로 만든다.
// 칸 하나는 마을에서 `TOWN_CELL` px로 그린다. 기준점은 그림의 아랫변 가운데(발밑).
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

function darken(hex: string, amount = 0.25): string {
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
    B: "#4caf50",
    T: "#d8cfc0",
    t: "#b8ad9c",
    Y: "#f4c430",
    H: "#2e7d32",
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
  return art(g, { K: "#2b2b2b", B: mine ? "#4a90d9" : "#d9534f", P: "#6b4a2f", F: "#ffd23f" });
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

/** 나무 (두 가지 초록) */
export function treeArt(variant: number): PixelArt {
  const g = grid(12, 16);
  fill(g, 5, 10, 2, 6, "N");
  for (let y = 0; y < 11; y++) {
    const t = (y - 5) / 5.5;
    const half = Math.round(6 * Math.sqrt(Math.max(0, 1 - t * t)));
    fill(g, 6 - half, y, half * 2, 1, "L");
  }
  for (let y = 6; y < 11; y++) {
    const t = (y - 5) / 5.5;
    const half = Math.round(6 * Math.sqrt(Math.max(0, 1 - t * t)));
    fill(g, 6 - half, y, Math.max(1, half - 1), 1, "D");
  }
  g[3][4] = "H";
  g[4][7] = "H";
  return art(g, variant % 2 === 0 ? { N: "#7a4a2a", L: "#4caf50", D: "#388e3c", H: "#81c784" } : { N: "#7a4a2a", L: "#2e7d32", D: "#1b5e20", H: "#66bb6a" });
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

/** 벚나무 (분홍 꽃 나무) */
export function cherryTreeArt(): PixelArt {
  const g = grid(14, 18);
  fill(g, 6, 11, 2, 7, "N");
  g[12][5] = "N";
  g[11][8] = "N";
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
  return art(g, { N: "#6b4226", L: "#ffb7c5", D: "#f48fb1", H: "#fff0f5" });
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

/**
 * 등불 (plaza-upgrade-2): 글 쓴 날 수에 따라 크기가 다르다(`s`·`m`·`l`), `lit`이면 불이 켜진다.
 * TODO(world): 지금은 빈 1칸 그림
 */
export function lanternArt(lit: boolean, size: "s" | "m" | "l"): PixelArt {
  void lit;
  void size;
  return art(grid(1, 1), {});
}

/**
 * 추천 이웃의 흐린 집 (plaza-upgrade-2): 아직 이웃이 아닌 추천 블로그를 빈 집터에 흐리게 보인다.
 * TODO(world): 지금은 빈 1칸 그림
 */
export function ghostHouseArt(stage = 0, roof = "#c0c0c0"): PixelArt {
  void stage;
  void roof;
  return art(grid(1, 1), {});
}
