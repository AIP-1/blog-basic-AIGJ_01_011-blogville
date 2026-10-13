import type { CSSProperties } from "react";

// 블로그 강조색 (블로그 꾸미기): 버튼·링크·선택 표시 색. 밝은 화면·어두운 화면 색을 따로 둔다
// 밝은 색은 흰 글씨와, 어두운 색은 어두운 바탕 위 글씨로 대비 4.5:1 이상

export const BLOG_ACCENTS = [
  { key: "green", label: "초록", light: "#2a7348", dark: "#5cbf85" },
  { key: "blue", label: "파랑", light: "#1f5fa8", dark: "#7fb2ec" },
  { key: "purple", label: "보라", light: "#6b46b8", dark: "#b49cf0" },
  { key: "pink", label: "분홍", light: "#b0306a", dark: "#f08cb8" },
  { key: "orange", label: "주황", light: "#a34a12", dark: "#f0a46a" },
  { key: "gray", label: "회색", light: "#4a4f57", dark: "#aab1bb" },
] as const;

export type BlogAccent = (typeof BLOG_ACCENTS)[number]["key"];

export const DEFAULT_ACCENT: BlogAccent = "green";

export function isBlogAccent(value: unknown): value is BlogAccent {
  return BLOG_ACCENTS.some((a) => a.key === value);
}

/** 블로그 화면을 감싸는 칸에 줄 CSS 변수 (기본 초록이면 아무것도 바꾸지 않는다) */
export function accentStyle(key: string | null | undefined): CSSProperties | undefined {
  const accent = BLOG_ACCENTS.find((a) => a.key === key);
  if (!accent || accent.key === DEFAULT_ACCENT) return undefined;
  return { "--blog-accent": accent.light, "--blog-accent-dark": accent.dark } as CSSProperties;
}

export const ACCENT_ERROR = "고를 수 있는 색이 아니에요.";

/** 블로그 화면 바깥 칸에 펼쳐 넣는 속성. 강조색이 기본이면 빈 객체 */
export function accentProps(key: string | null | undefined): { "data-blog-accent"?: string; style?: CSSProperties } {
  const style = accentStyle(key);
  return style ? { "data-blog-accent": "", style } : {};
}
