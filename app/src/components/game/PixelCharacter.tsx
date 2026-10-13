import { CHARACTER_ART, pixelRects } from "@/lib/art/characters";

/**
 * 도트 캐릭터 그림 (GAME-01). `art`가 없거나 모르는 키면 아무것도 그리지 않는다.
 * 이름이 있으면 그림으로 읽히고(`role="img"`), 없으면 꾸밈이라 숨긴다.
 */
export function PixelCharacter({ art, size = 56, label }: { art: string | null | undefined; size?: number; label?: string }) {
  const data = art ? CHARACTER_ART[art] : undefined;
  if (!data) return null;
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className="shrink-0"
      data-character={art}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {pixelRects(data).map((r) => (
        <rect key={`${r.x},${r.y}`} x={r.x} y={r.y} width={r.width} height={1} fill={r.fill} />
      ))}
    </svg>
  );
}
