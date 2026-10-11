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

/**
 * 보여줄 페이지 번호 (POST-05): 첫 페이지, 마지막 페이지, 현재 페이지 앞뒤 2개. 사이가 비면 "…".
 * 1페이지뿐이면 빈 배열. 마지막보다 큰 현재 페이지는 앞뒤를 붙이지 않는다.
 */
export function pageNumbers(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 1) return [];
  const shown = new Set([1, totalPages]);
  for (let n = page - 2; n <= page + 2; n++) if (n >= 1 && n <= totalPages) shown.add(n);
  const sorted = [...shown].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(n - sorted[i - 1] === 2 ? n - 1 : "…");
    out.push(n);
  });
  return out;
}
