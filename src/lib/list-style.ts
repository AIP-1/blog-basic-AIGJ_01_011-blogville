// 블로그 글 목록 모양 (블로그 꾸미기): 카드형(기본)·목록형(제목만 한 줄씩)·앨범형(대표 사진 칸)

export const LIST_STYLES = [
  { key: "card", label: "카드형", hint: "제목·요약·대표 사진" },
  { key: "list", label: "목록형", hint: "제목만 한 줄씩" },
  { key: "gallery", label: "앨범형", hint: "대표 사진을 크게" },
] as const;

export type ListStyle = (typeof LIST_STYLES)[number]["key"];

export const DEFAULT_LIST_STYLE: ListStyle = "card";

export function isListStyle(value: unknown): value is ListStyle {
  return LIST_STYLES.some((s) => s.key === value);
}

/** DB 값(NULL이면 기본) → 목록 모양 */
export function listStyleOf(value: string | null | undefined): ListStyle {
  return isListStyle(value) ? value : DEFAULT_LIST_STYLE;
}

export const LIST_STYLE_ERROR = "고를 수 있는 모양이 아니에요.";
