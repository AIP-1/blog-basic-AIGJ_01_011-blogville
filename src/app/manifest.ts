import type { MetadataRoute } from "next";

// 휴대폰 "홈 화면에 추가"로 앱처럼 열 때의 이름·색·아이콘
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Blogville",
    short_name: "Blogville",
    description: "글을 쓸수록 내 마을이 자라는 블로그",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#2f7d4f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
