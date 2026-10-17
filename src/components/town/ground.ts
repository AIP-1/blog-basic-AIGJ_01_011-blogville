// 마을 바닥 (TOWN-02·05): 잔디·흙길·돌광장·절벽 앞면·계단·먼 하늘을 도트(칸 4px)로 한 번만 굽는다. 브라우저에서만 부른다.
// 광장 개편: 하늘 시각(새벽·노을·밤)마다 먼 하늘 띠, 밤하늘 별, 가로등·창 불빛 무리도 여기서 굽는다.
import { CENTER, GARDEN, PLAZA_RADIUS, ROADS, WORLD } from "@/lib/town/layout";
import type { Season } from "@/lib/town/season";
import type { Sky } from "@/lib/town/sky";
import { CLIFF_FACE, CLIFF_LINES, RAIL, SKY_HEIGHT, STAIRS } from "@/lib/town/terrain";

export const GROUND_CELL = 4;

/** 계절마다 잔디 색 (높은 단·가운데·낮은 단, 잔디 점 넷, 정원 줄무늬 둘). 여름이 예전 그림 */
const GRASS: Record<Season, { bands: [string, string, string]; dots: string[]; garden: [string, string]; flowers: string[]; flowerCount: number }> = {
  spring: { bands: ["#8ad074", "#80c86c", "#76bd63"], dots: ["#70b65e", "#94d67f", "#70b65e", "#62a651"], garden: ["#8ed87c", "#83cd70"], flowers: ["#ffffff", "#ffd166", "#ff8fab", "#ffc2d4"], flowerCount: 420 },
  summer: { bands: ["#86cc72", "#7cc46a", "#72b961"], dots: ["#6db35c", "#8fd27c", "#6db35c", "#5fa34f"], garden: ["#8ad67a", "#7fcb6e"], flowers: ["#ffffff", "#ffd166", "#ff8fab", "#b39ddb"], flowerCount: 260 },
  autumn: { bands: ["#93c46a", "#89bb62", "#7fb15a"], dots: ["#7aa956", "#a3cb74", "#7aa956", "#6c9a4c"], garden: ["#95cc72", "#8ac168"], flowers: ["#ffffff", "#e9b341", "#d9692e", "#b39ddb"], flowerCount: 140 },
  winter: { bands: ["#a9c99a", "#a0c191", "#97b888"], dots: ["#8fb07f", "#bcd6af", "#e9f0f2", "#86a777"], garden: ["#aecda0", "#a5c597"], flowers: ["#f4f7fb", "#e9f0f2"], flowerCount: 520 },
};
/** 가을 낙엽 도트 (길·잔디) */
const LEAVES = ["#d9692e", "#e9b341", "#b04a22", "#c98f24"];
const GRASS_LEAVES = ["#a2552a", "#a8822f", "#8a4022"];

export function bakeGround(season: Season = "summer"): HTMLCanvasElement {
  const look = GRASS[season];
  const w = WORLD.width / GROUND_CELL;
  const h = WORLD.height / GROUND_CELL;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // 잔디: 높은 단일수록 밝게 (북쪽 언덕 · 가운데 · 남쪽 들판)
  const c = (v: number) => Math.round(v / GROUND_CELL);
  const [north, south] = CLIFF_LINES.map(c);
  ctx.fillStyle = look.bands[0];
  ctx.fillRect(0, 0, w, north);
  ctx.fillStyle = look.bands[1];
  ctx.fillRect(0, north, w, south - north);
  ctx.fillStyle = look.bands[2];
  ctx.fillRect(0, south, w, h - south);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const dots = look.dots;
  for (let i = 0; i < (w * h) / 9; i++) {
    ctx.fillStyle = dots[i % dots.length];
    ctx.fillRect(Math.floor(random() * w), Math.floor(random() * h), 1, 1);
  }
  const flowers = look.flowers;
  for (let i = 0; i < look.flowerCount; i++) {
    ctx.fillStyle = flowers[i % flowers.length];
    ctx.fillRect(Math.floor(random() * w), Math.floor(random() * h), 1, 1);
  }
  // 내 정원 (TOWN-20): 깎은 잔디 줄무늬
  for (let y = c(GARDEN.y); y < c(GARDEN.y + GARDEN.height); y++) {
    ctx.fillStyle = Math.floor((y - c(GARDEN.y)) / 6) % 2 === 0 ? look.garden[0] : look.garden[1];
    ctx.fillRect(c(GARDEN.x), y, c(GARDEN.width), 1);
  }
  // 흙길: 테두리 한 칸 진하게
  ctx.fillStyle = "#b8925f";
  for (const r of ROADS) ctx.fillRect(c(r.x) - 1, c(r.y) - 1, c(r.width) + 2, c(r.height) + 2);
  ctx.fillStyle = "#d9b98a";
  for (const r of ROADS) ctx.fillRect(c(r.x), c(r.y), c(r.width), c(r.height));
  ctx.fillStyle = "#cfae7d";
  for (let i = 0; i < 1400; i++) {
    const r = ROADS[i % ROADS.length];
    ctx.fillRect(c(r.x) + Math.floor(random() * c(r.width)), c(r.y) + Math.floor(random() * c(r.height)), 1, 1);
  }
  // 가을 낙엽: 길 위에 많이, 잔디에 조금 (광장 개편 2, A5)
  if (season === "autumn") {
    for (let i = 0; i < 900; i++) {
      const r = ROADS[i % ROADS.length];
      ctx.fillStyle = LEAVES[i % LEAVES.length];
      ctx.fillRect(c(r.x) + Math.floor(random() * c(r.width)), c(r.y) + Math.floor(random() * c(r.height)), 1, 1);
    }
    // 잔디 위는 적게, 진한 색으로 (밝은 빨강 점은 밤 덧칠 아래에서 잡티처럼 보였다)
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = GRASS_LEAVES[i % GRASS_LEAVES.length];
      ctx.fillRect(Math.floor(random() * w), Math.floor(random() * h), 1, 1);
    }
  }
  // 돌광장: 원 안을 돌 타일로
  const cx = c(CENTER.x);
  const cy = c(CENTER.y);
  const radius = c(PLAZA_RADIUS);
  for (let y = -radius - 1; y <= radius + 1; y++) {
    for (let x = -radius - 1; x <= radius + 1; x++) {
      const d = Math.hypot(x, y);
      if (d > radius + 1) continue;
      if (d > radius) ctx.fillStyle = "#9c9486";
      else if ((x + 200) % 8 === 0 || (y + 200) % 6 === 0) ctx.fillStyle = "#c2baab";
      else ctx.fillStyle = (Math.floor((x + 200) / 8) + Math.floor((y + 200) / 6)) % 2 === 0 ? "#ddd6c8" : "#d4ccbd";
      ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
  drawCliffs(ctx, w, c);
  drawSky(ctx, w, c(SKY_HEIGHT), SKY_COLORS.day);
  // 대기 원근: 북쪽(먼 곳)일수록 하늘빛을 섞는다
  const air = ctx.createLinearGradient(0, 0, 0, c(900));
  air.addColorStop(0, "rgba(214, 233, 255, 0.28)");
  air.addColorStop(1, "rgba(214, 233, 255, 0)");
  ctx.fillStyle = air;
  ctx.fillRect(0, 0, w, c(900));
  return canvas;
}

/** 절벽 앞면(돌벽)과 계단 (TOWN-05). 앞면은 높은 단 가장자리에서 아래로 `CLIFF_FACE` */
function drawCliffs(ctx: CanvasRenderingContext2D, w: number, c: (v: number) => number) {
  const face = c(CLIFF_FACE);
  for (const line of CLIFF_LINES) {
    const top = c(line);
    // 가장자리 풀 한 줄, 돌벽(줄눈은 엇갈려), 아래 그림자
    ctx.fillStyle = "#5c9a4c";
    ctx.fillRect(0, top - 1, w, 1);
    for (let y = 0; y < face; y++) {
      const course = Math.floor(y / 3);
      for (let x = 0; x < w; x++) {
        const joint = y % 3 === 2 || (x + (course % 2) * 3) % 6 === 0;
        ctx.fillStyle = joint ? "#7d7262" : y < 1 ? "#b3a890" : (x * 7 + course * 13) % 11 === 0 ? "#a39782" : "#9b8f7c";
        ctx.fillRect(x, top + y, 1, 1);
      }
    }
    ctx.fillStyle = "#5f574b";
    ctx.fillRect(0, top + face - 1, w, 1);
    ctx.fillStyle = "rgba(40, 60, 30, 0.25)";
    ctx.fillRect(0, top + face, w, 2);
  }
  // 계단: 디딤돌 두 줄씩 밝게·어둡게, 양쪽 돌 난간
  for (const s of STAIRS) {
    const x = c(s.rect.x);
    const y = c(s.rect.y);
    const sw = c(s.rect.width);
    const rail = Math.max(1, c(RAIL));
    for (let r = -1; r < face; r++) {
      ctx.fillStyle = r < 0 ? "#cbbd9f" : r % 3 === 0 ? "#8f826b" : r % 3 === 1 ? "#d6c9ab" : "#bcae90";
      ctx.fillRect(x + rail, y + r, sw - rail * 2, 1);
    }
    ctx.fillStyle = "#6e6455";
    ctx.fillRect(x, y - 1, rail, face + 1);
    ctx.fillRect(x + sw - rail, y - 1, rail, face + 1);
  }
}

/** 먼 하늘 띠의 색: 위·아래 하늘, 먼 산, 가까운 숲. 낮은 예전 그림 그대로 */
const SKY_COLORS: Record<Sky, { top: string; bottom: string; far: string; near: string }> = {
  day: { top: "#a9d8ff", bottom: "#e2f2ff", far: "#a7bfd6", near: "#6f9f6a" },
  dawn: { top: "#b7a6dc", bottom: "#f8cbbd", far: "#b4a2c8", near: "#7d9878" },
  dusk: { top: "#e98c62", bottom: "#ffd394", far: "#c48777", near: "#6c7c4c" },
  night: { top: "#1b2149", bottom: "#36477e", far: "#2a3563", near: "#1f3a2e" },
};

/** 맨 위 먼 하늘과 산 (걸을 수 없는 띠) */
function drawSky(ctx: CanvasRenderingContext2D, w: number, sky: number, colors: (typeof SKY_COLORS)[Sky]) {
  const g = ctx.createLinearGradient(0, 0, 0, sky);
  g.addColorStop(0, colors.top);
  g.addColorStop(1, colors.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, sky);
  // 먼 산 (푸른빛), 가까운 숲 (진한 초록) 실루엣
  for (const [base, amp, period, color] of [
    [sky - 6, 9, 61, colors.far],
    [sky - 2, 5, 23, colors.near],
  ] as const) {
    ctx.fillStyle = color;
    for (let x = 0; x < w; x++) {
      const peak = Math.round(amp * (0.6 + 0.4 * Math.sin((x / period) * Math.PI * 2) * Math.cos((x / (period * 2.3)) * Math.PI)));
      ctx.fillRect(x, base - peak, 1, sky - (base - peak));
    }
  }
}

/** 낮이 아닌 하늘의 먼 하늘 띠 (바닥 위 맨 위 `SKY_HEIGHT`에 덮어 그린다). 칸 4px */
export function bakeSkyBand(sky: Exclude<Sky, "day">): HTMLCanvasElement {
  const w = WORLD.width / GROUND_CELL;
  const h = Math.round(SKY_HEIGHT / GROUND_CELL);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  drawSky(canvas.getContext("2d")!, w, h, SKY_COLORS[sky]);
  return canvas;
}

/** 밤하늘 별 (먼 하늘 띠 위쪽, 칸 4px). 하늘 덧칠 뒤에 그려 어둠에 묻히지 않는다 */
export function bakeStars(): HTMLCanvasElement {
  const w = WORLD.width / GROUND_CELL;
  const h = Math.round(SKY_HEIGHT / GROUND_CELL);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  let seed = 41;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < w / 9; i++) {
    ctx.fillStyle = i % 5 === 0 ? "#fff3c4" : "#e8ecff";
    ctx.fillRect(Math.floor(random() * w), Math.floor(random() * (h - 9)), 1, 1);
  }
  return canvas;
}

/**
 * 도트 빛 무리 (가로등·불 켜진 창): 4px 칸으로 끊은 동심 타원 몇 겹. 안쪽 겹일수록 진하다(`alphas` 안쪽부터).
 * 흐린 그러데이션 대신 계단으로 끊어 도트 그림과 어울리게 하고, `lighter`로 더해 그린다. 칸 수 × 4px 크기로 늘려 찍는다.
 */
export function bakeGlow(rx: number, ry: number, rgb: readonly [number, number, number], alphas: readonly number[]): HTMLCanvasElement {
  const w = Math.max(1, Math.round((rx * 2) / GROUND_CELL));
  const h = Math.max(1, Math.round((ry * 2) / GROUND_CELL));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot((x + 0.5 - w / 2) / (w / 2), (y + 0.5 - h / 2) / (h / 2));
      const ring = Math.floor(d * alphas.length);
      if (ring >= alphas.length) continue;
      ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alphas[ring]})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}
