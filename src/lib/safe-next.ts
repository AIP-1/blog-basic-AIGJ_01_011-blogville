/** 돌아갈 주소(`?next=`)의 최대 길이 */
export const NEXT_MAX = 2048;

const BASE = "http://next.invalid";

/**
 * 로그인 뒤 돌아갈 주소 (AUTH-09 열린 질문). 이 사이트 안의 `/…` 주소만 통과시키고 나머지는 null.
 * `//evil.com`·`/\evil.com`처럼 브라우저가 다른 사이트로 읽는 값, 탭·줄바꿈이 섞인 값(브라우저가 지우면 `//`가 된다),
 * 점 경로를 풀면 `//`가 되는 값은 막는다.
 */
export function safeNext(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > NEXT_MAX) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  // 제어 문자·역슬래시는 정상적인 주소에 없다
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  // `/..//evil.com`·`/.//evil.com`은 점 경로를 풀면 `//evil.com`이 되므로 푼 결과를 다시 본다
  const out = `${url.pathname}${url.search}${url.hash}`;
  return out.startsWith("//") ? null : out;
}

/** 첫 화면(로그인)으로 가되 로그인하면 `path`로 돌아오는 주소 */
export function loginHref(path: string): string {
  return path === "/" ? "/" : `/?next=${encodeURIComponent(path)}`;
}
