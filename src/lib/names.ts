export const USERNAME_RE = /^[a-z0-9_]{4,20}$/;
export const SLUG_RE = /^[a-z0-9_]{3,20}$/;

/** 아이디·블로그 주소로 쓸 수 없는 이름 (명세 BLOG-02). 나중 기능의 주소와 부딪치지 않게 미리 막는다. */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  "admin", "api", "town", "feed", "shop", "closet", "write", "settings", "blog", "onboarding",
  "farm", "attendance", "tags", "wallet", "files", "notice", "notifications", "fishing", "house",
  "salon", "clothes",
]);

/** 앞뒤 공백을 지우고 소문자로 바꾼다 (아이디·블로그 주소). */
export function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

export function isReserved(name: string): boolean {
  return RESERVED_NAMES.has(name);
}
