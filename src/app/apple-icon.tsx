import { ImageResponse } from "next/og";
import { pixelPaths } from "@/lib/art/paths";
import { houseMarkArt, INK } from "@/lib/art/site";

// 아이폰 홈 화면 아이콘 (icon.svg와 같은 도트 집, 180×180 PNG): 종이색 바탕에 칸 하나 10px
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const mark = houseMarkArt({ ink: INK });
  const w = mark.rows[0].length;
  const h = mark.rows.length;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fbf1dc" }}>
        <svg width={w * 10} height={h * 10} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges">
          {pixelPaths([mark]).map((p) => (
            <path key={p.fill} d={p.d} fill={p.fill} />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
