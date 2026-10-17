import type { PixelArt } from "@/lib/art/characters";
import { artCells, pixelPaths } from "@/lib/art/paths";

/**
 * 마을 도트 그림(집·가게·아이콘)을 SVG로 (광장 개편). 칸 하나를 `cell`px로, 흐림 없이(crispEdges) 그린다.
 * 여러 장이면 첫 장 크기에 맞춰 겹친다. 이름이 있으면 그림으로 읽히고(`role="img"`), 없으면 꾸밈이라 숨긴다.
 * 캐릭터 16칸 그림은 `PixelLayers`(그림 키)를 쓴다.
 */
export function PixelArtSvg({
  art,
  cell = 4,
  label,
  className = "",
}: {
  art: PixelArt | readonly PixelArt[];
  /** 칸 하나의 px (정수일 때 가장 또렷하다) */
  cell?: number;
  label?: string;
  className?: string;
}) {
  const arts: readonly PixelArt[] = Array.isArray(art) ? art : [art as PixelArt];
  if (arts.length === 0) return null;
  const { width, height } = artCells(arts[0]);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width * cell}
      height={height * cell}
      shapeRendering="crispEdges"
      className={`shrink-0 ${className}`}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {pixelPaths(arts).map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} />
      ))}
    </svg>
  );
}
