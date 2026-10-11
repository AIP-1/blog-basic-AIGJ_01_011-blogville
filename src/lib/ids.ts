/** DB `integer` 최댓값. 글·카테고리 ID와 페이지 번호는 이 범위만 받는다. */
export const ID_MAX = 2147483647;

/**
 * 숫자만 적힌 1~2147483647 정수면 그 수, 아니면 null.
 * `012`, `1e1`, `2.5`, `-1`, `0`, 공백이 섞인 값은 모두 무효다 (#21).
 */
export function parseId(value: unknown): number | null {
  if (typeof value !== "string" || !/^[1-9][0-9]{0,9}$/.test(value)) return null;
  const n = Number(value);
  return n <= ID_MAX ? n : null;
}

/** `?page=` 값. 무효면 1페이지. */
export function parsePage(value: unknown): number {
  return parseId(value) ?? 1;
}
