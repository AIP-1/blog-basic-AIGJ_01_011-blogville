import { pixelRects } from "@/lib/art/characters";
import { findArt } from "@/lib/art";

/**
 * 도트 그림 여러 장을 차례로 겹쳐 그린다 (아래 → 위). 모르는 키는 건너뛴다.
 * 이름이 있으면 그림으로 읽히고(`role="img"`), 없으면 꾸밈이라 숨긴다.
 */
export function PixelLayers({
  arts,
  size = 56,
  label,
  className = "",
  stretch = false,
}: {
  arts: readonly string[];
  size?: number;
  label?: string;
  className?: string;
  /** 칸을 꽉 채운다 (미니룸 배경). 가로세로 비율을 맞추지 않는다 */
  stretch?: boolean;
}) {
  const layers = arts.flatMap((key) => {
    const art = findArt(key);
    return art ? [{ key, rects: pixelRects(art) }] : [];
  });
  if (layers.length === 0) return null;
  return (
    <svg
      viewBox="0 0 16 16"
      width={stretch ? "100%" : size}
      height={stretch ? "100%" : size}
      preserveAspectRatio={stretch ? "none" : undefined}
      shapeRendering="crispEdges"
      className={`shrink-0 ${className}`}
      data-art={arts.join(" ")}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {layers.map(({ key, rects }, i) => (
        <g key={`${i}:${key}`}>
          {rects.map((r) => (
            <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
          ))}
        </g>
      ))}
    </svg>
  );
}
