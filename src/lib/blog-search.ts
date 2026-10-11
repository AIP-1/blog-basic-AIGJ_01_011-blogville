// 블로그 안 검색·태그 걸러 보기 (BLOG-09)

export const SEARCH_MAX = 50;
export const SEARCH_EMPTY = "찾을 말을 적어 주세요";

/**
 * `?s=` 값. 앞뒤 공백을 지우고 1~50자면 그 말, 비었거나 공백만이면 "empty"(문구를 보여 준다),
 * 값이 없거나 51자 이상·배열이면 null(무시).
 */
export function parseSearchQuery(value: unknown): string | "empty" | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return "empty";
  return [...trimmed].length <= SEARCH_MAX ? trimmed : null;
}

/** `?tag=` 값: 태그 저장 규칙대로(공백 한 칸, 소문자) 1~50자, 아니면 null */
export function parseTagFilter(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ").toLowerCase();
  return trimmed.length > 0 && [...trimmed].length <= SEARCH_MAX ? trimmed : null;
}

/** ILIKE 패턴: `%`·`_`·`\`는 글자 그대로 찾는다 */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
