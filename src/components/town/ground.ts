// 마을 바닥 (TOWN-02): 잔디·흙길·돌광장을 도트(칸 4px)로 한 번만 굽는다. 브라우저에서만 부른다.
import { CENTER, PLAZA_RADIUS, ROADS, WORLD } from "@/lib/town/layout";

export const GROUND_CELL = 4;

export function bakeGround(): HTMLCanvasElement {
  const w = WORLD.width / GROUND_CELL;
  const h = WORLD.height / GROUND_CELL;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // 잔디
  ctx.fillStyle = "#7cc46a";
  ctx.fillRect(0, 0, w, h);
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const dots = ["#6db35c", "#8fd27c", "#6db35c", "#5fa34f"];
  for (let i = 0; i < (w * h) / 9; i++) {
    ctx.fillStyle = dots[i % dots.length];
    ctx.fillRect(Math.floor(random() * w), Math.floor(random() * h), 1, 1);
  }
  const flowers = ["#ffffff", "#ffd166", "#ff8fab", "#b39ddb"];
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = flowers[i % flowers.length];
    ctx.fillRect(Math.floor(random() * w), Math.floor(random() * h), 1, 1);
  }
  // 흙길: 테두리 한 칸 진하게
  const c = (v: number) => Math.round(v / GROUND_CELL);
  ctx.fillStyle = "#b8925f";
  for (const r of ROADS) ctx.fillRect(c(r.x) - 1, c(r.y) - 1, c(r.width) + 2, c(r.height) + 2);
  ctx.fillStyle = "#d9b98a";
  for (const r of ROADS) ctx.fillRect(c(r.x), c(r.y), c(r.width), c(r.height));
  ctx.fillStyle = "#cfae7d";
  for (let i = 0; i < 1400; i++) {
    const r = ROADS[i % ROADS.length];
    ctx.fillRect(c(r.x) + Math.floor(random() * c(r.width)), c(r.y) + Math.floor(random() * c(r.height)), 1, 1);
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
  return canvas;
}
