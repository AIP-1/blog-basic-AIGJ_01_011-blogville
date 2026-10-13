import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// 사진이 없는 화면을 카카오톡·SNS에 공유할 때 보이는 기본 미리보기 그림 (1200×630)
export const alt = "Blogville — 글을 쓸수록 내 마을이 자라는 블로그";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (file: string) => readFile(path.join(process.cwd(), "node_modules/pretendard/dist/public/static", file));

export default async function OpengraphImage() {
  const [bold, extraBold] = await Promise.all([font("Pretendard-Bold.otf"), font("Pretendard-ExtraBold.otf")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fbfaf7", padding: 72, fontFamily: "Pretendard" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* 사이트 아이콘(icon.svg)과 같은 집 */}
          <svg width="120" height="120" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="#2f7d4f" />
            <path d="M8 17 16 9l8 8v7H8z" fill="#fbfaf7" />
            <rect x="14" y="19" width="4" height="5" fill="#2f7d4f" />
          </svg>
          <div style={{ fontSize: 96, fontWeight: 800, color: "#2f7d4f" }}>Blogville</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#23201b" }}>글을 쓸수록 내 마을이 자라는 블로그</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: "#6f6a61" }}>글쓰기 · 이웃 · 도트 마을 · 내 캐릭터</div>
        </div>
        {/* 아래 잔디 띠 */}
        <div style={{ display: "flex", height: 28, borderRadius: 14, background: "linear-gradient(90deg, #8cc63f, #2f7d4f)" }} />
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
