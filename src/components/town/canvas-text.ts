// 마을 캔버스 글씨 (광장 개편): 이름표·나무 간판·말풍선을 마을 UI 키트(town-kit.css)와 같은 모양으로 그린다.
// 글씨는 도트 글꼴 갈무리11 굵게 12px. 화면 배율(devicePixelRatio)이 정수일 때만 도트가 고르므로, 1.25·1.5배 화면은 Pretendard 13px로 대신 쓴다.
// 글씨 하나마다 화면 배율 크기의 오프스크린 캔버스에 한 번 굽고, 프레임마다 다시 쓴다(측정·그리기를 매번 하지 않는다).
import { shortName } from "@/lib/town/layout";

/** 이름표 모양: `plate` 집 문패·이웃 이름(종이), `mine` 내 집 문패(초록 테두리), `sign` 건물 간판(나무), `player` 내 캐릭터(초록), `bubble` 말풍선(꼬리) */
export type TagStyle = "plate" | "mine" | "sign" | "player" | "bubble";

/** 글꼴을 다 받았는지 묻는 값 (`document.fonts.load`). 받으면 구운 글씨를 비우고 갈무리로 다시 굽는다 */
export const PIXEL_FONT_PROBE = "700 12px Galmuri11";

/** 이름표 상자 (CSS px): 먹 테두리 2(모서리 2×2칸은 비워 도트 홈), 안쪽 여백 가로 6·세로 2, 글줄 16, 말풍선 꼬리 6 */
export const TAG_BOX = { border: 2, padX: 6, padY: 2, line: 16, tail: 6 } as const;

/** 말풍선 제목은 이만큼에서 줄인다 */
export const BUBBLE_CHARS = 14;

type Paint = { fill: string; edge: string; ink: string; hi?: string };

// 키트 토큰(--kit-*)과 같은 값. 캔버스는 다크 모드와 상관없이 마을 하늘(sky)을 따른다
const PAINT: Record<TagStyle, Paint> = {
  plate: { fill: "#fbf1dc", edge: "#3b2a20", ink: "#3b2a20" },
  mine: { fill: "#fbf1dc", edge: "#2a7348", ink: "#1d5434" },
  sign: { fill: "#8a5a34", edge: "#5e3c2c", ink: "#fbf1dc", hi: "#b07a4a" },
  player: { fill: "#2a7348", edge: "#3b2a20", ink: "#fbf1dc" },
  bubble: { fill: "#fbf1dc", edge: "#3b2a20", ink: "#3b2a20" },
};

/** 화면 배율에 맞는 글꼴: 정수 배율이면 갈무리 12px × 배율(도트 1칸 = 화면 점 n개), 아니면 Pretendard 13px */
export function tagFont(dpr: number, families: { pixel: string; sans: string }): { font: string; pixel: boolean } {
  const pixel = Number.isInteger(dpr) && dpr >= 1;
  return pixel ? { font: `700 ${12 * dpr}px ${families.pixel}`, pixel } : { font: `600 ${13 * dpr}px ${families.sans}`, pixel };
}

/** 글 쓴 이웃의 말풍선 글: `✎ 새 글 제목…` (14자에서 줄인다) */
export function bubbleText(title: string, max = BUBBLE_CHARS): string {
  return `✎ ${shortName(title.replace(/\s+/g, " ").trim(), max)}`;
}

/** 이름표 높이 (CSS px, 말풍선은 꼬리 포함) */
export function tagHeight(style: TagStyle): number {
  return TAG_BOX.border * 2 + TAG_BOX.padY * 2 + TAG_BOX.line + (style === "bubble" ? TAG_BOX.tail : 0);
}

/** 정수 배율로 반올림한 화면 점 (최소 1) */
const px = (v: number, scale: number) => Math.max(1, Math.round(v * scale));

/**
 * 구운 이름표 모음. `setScale`로 화면 배율이 바뀌거나 `clear`(글꼴을 다 받음)하면 비운다.
 * `draw`는 이름표의 아랫변 가운데를 (x, y) CSS px에 맞춰, 화면 점 하나에 그림 점 하나로(흐림 없이) 찍는다.
 */
export class TagCache {
  private readonly baked = new Map<string, HTMLCanvasElement>();
  private scale = 1;
  private readonly measure: CanvasRenderingContext2D;

  constructor(private readonly families: { pixel: string; sans: string }) {
    this.measure = document.createElement("canvas").getContext("2d")!;
  }

  setScale(dpr: number): void {
    if (dpr === this.scale) return;
    this.scale = dpr;
    this.baked.clear();
  }

  clear(): void {
    this.baked.clear();
  }

  /** 이름표 크기 (CSS px) */
  size(text: string, style: TagStyle): { width: number; height: number } {
    const img = this.get(text, style);
    return { width: img.width / this.scale, height: img.height / this.scale };
  }

  /** 아랫변 가운데 (x, y)에 그린다. 그린 높이(CSS px)를 돌려준다. 그리고 나면 변환을 화면 배율로 되돌린다 */
  draw(ctx: CanvasRenderingContext2D, text: string, style: TagStyle, x: number, y: number): number {
    const img = this.get(text, style);
    const s = this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(img, Math.round(x * s - img.width / 2), Math.round(y * s) - img.height);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    return img.height / s;
  }

  private get(text: string, style: TagStyle): HTMLCanvasElement {
    const key = `${style}\u0000${text}`;
    const hit = this.baked.get(key);
    if (hit) return hit;
    const img = this.bake(text, style);
    this.baked.set(key, img);
    return img;
  }

  private bake(text: string, style: TagStyle): HTMLCanvasElement {
    const s = this.scale;
    const { font } = tagFont(s, this.families);
    const paint = PAINT[style];
    const m = this.measure;
    m.font = font;
    const metrics = m.measureText(text);
    const b = px(TAG_BOX.border, s);
    const padX = px(TAG_BOX.padX, s);
    const padY = px(TAG_BOX.padY, s);
    const line = px(TAG_BOX.line, s);
    const tail = style === "bubble" ? px(TAG_BOX.tail, s) : 0;
    const width = Math.ceil(metrics.width) + padX * 2 + b * 2;
    const height = line + padY * 2 + b * 2;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height + tail;
    const ctx = canvas.getContext("2d")!;
    // 종이(나무) 바탕과 네 변의 먹 테두리: 모서리 칸을 비워 둥글리지 않고 도트 홈으로 깎는다
    ctx.fillStyle = paint.fill;
    ctx.fillRect(b, b, width - b * 2, height - b * 2);
    ctx.fillStyle = paint.edge;
    ctx.fillRect(b, 0, width - b * 2, b);
    ctx.fillRect(b, height - b, width - b * 2, b);
    ctx.fillRect(0, b, b, height - b * 2);
    ctx.fillRect(width - b, b, b, height - b * 2);
    if (paint.hi) {
      // 나무 간판 윗줄의 밝은 결
      ctx.fillStyle = paint.hi;
      ctx.fillRect(b, b, width - b * 2, b);
    }
    if (tail > 0) {
      // 아래 가운데 계단 꼬리 (.px-bubble::after와 같은 모양)
      ctx.fillStyle = paint.edge;
      const step = Math.max(1, Math.round(tail / 3));
      for (let i = 0; i * step < tail; i++) {
        const w = Math.max(b, (6 - i * 2) * b);
        ctx.fillRect(Math.round(width / 2 - w / 2), height + i * step, w, step);
      }
    }
    // 글씨: 글줄 가운데에, 기준선은 화면 점에 맞춘다
    ctx.font = font;
    ctx.fillStyle = paint.ink;
    ctx.textBaseline = "alphabetic";
    const ascent = metrics.fontBoundingBoxAscent || line * 0.8;
    const descent = metrics.fontBoundingBoxDescent || line * 0.2;
    const baseline = Math.round(b + padY + (line - (ascent + descent)) / 2 + ascent);
    ctx.fillText(text, b + padX, baseline);
    return canvas;
  }
}
