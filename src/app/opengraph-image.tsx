import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { pixelPaths } from "@/lib/art/paths";
import { BRAND_GREEN, houseMarkArt, INK } from "@/lib/art/site";

// 사진이 없는 화면을 카카오톡·SNS에 공유할 때 보이는 기본 미리보기 그림 (1200×630)
export const alt = "Blogville — 글을 쓸수록 내 마을이 자라는 블로그";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) => readFile(path.join(process.cwd(), "node_modules/pretendard/dist/public/static", file));

export default async function OpengraphImage() {
  const [bold, extraBold] = await Promise.all([font("Pretendard-Bold.otf"), font("Pretendard-ExtraBold.otf")]);
  const mark = houseMarkArt({ ink: INK });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fbfaf7", padding: 72, fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* 사이트 아이콘(icon.svg)·헤더 로고와 같은 도트 집 (칸 하나 8px) */}
          <svg width={mark.rows[0].length * 8} height={mark.rows.length * 8} viewBox={`0 0 ${mark.rows[0].length} ${mark.rows.length}`} shapeRendering="crispEdges">
            {pixelPaths([mark]).map((p) => (
              <path key={p.fill} d={p.d} fill={p.fill} />
            ))}
          </svg>
          <div style={{ fontSize: 96, fontWeight: 800, color: BRAND_GREEN }}>Blogville</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#23201b" }}>글을 쓸수록 내 마을이 자라는 블로그</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#6f6a61" }}>글쓰기 · 이웃 · 도트 마을 · 내 캐릭터</div>
        </div>
        {/* 아래 잔디 띠 (마을 바닥처럼 밝은 잔디 한 줄 + 브랜드 초록) */}
        <div style={{ display: "flex", flexDirection: "column", height: 28 }}>
          <div style={{ display: "flex", height: 8, background: "#7cc46a" }} />
          <div style={{ display: "flex", flex: 1, background: BRAND_GREEN }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
        { name: "Pretendard", data: extraBold, weight: 800, style: "normal" },
      ],
    },
  );
}
