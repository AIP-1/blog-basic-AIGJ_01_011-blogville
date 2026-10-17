import { pixelRects, type PixelArt } from "./characters";

/**
 * 도트 그림을 색마다 SVG path 하나로 (칸 1 = 좌표 1). 여러 장이면 아래 → 위로 겹친다.
 * `<rect>` 수백 개 대신 색 수만큼의 path라 화면(DOM)이 가볍다. 겹친 장은 순서를 지키려고 장마다 따로 묶는다.
 */
export function pixelPaths(arts: readonly PixelArt[]): { fill: string; d: string }[] {
  const out: { fill: string; d: string }[] = [];
  for (const art of arts) {
    const byFill = new Map<string, string[]>();
    for (const r of pixelRects(art)) {
      const list = byFill.get(r.fill) ?? [];
      list.push(`M${r.x} ${r.y}h${r.width}v1h-${r.width}z`);
      byFill.set(r.fill, list);
    }
    for (const [fill, parts] of byFill) out.push({ fill, d: parts.join("") });
  }
  return out;
}

/** 그림 크기 (칸 수) */
export function artCells(art: PixelArt): { width: number; height: number } {
  return { width: art.rows[0]?.length ?? 0, height: art.rows.length };
}
