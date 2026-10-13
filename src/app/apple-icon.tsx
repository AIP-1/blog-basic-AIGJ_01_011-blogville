import { ImageResponse } from "next/og";

// 아이폰 홈 화면 아이콘 (icon.svg와 같은 집, 180×180 PNG)
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#2f7d4f" }}>
        <svg width="140" height="140" viewBox="4 4 24 24">
          <path d="M8 17 16 9l8 8v7H8z" fill="#fbfaf7" />
          <rect x="14" y="19" width="4" height="5" fill="#2f7d4f" />
        </svg>
      </div>
    ),
    size,
  );
}
