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

/** 공지 블로그 주소 (AUTH-08). 예약어지만 관리자는 블로그 주소로 쓸 수 있다. */
export const NOTICE_SLUG = "notice";

/** 블로그 주소로 쓸 수 있는 예약어 규칙 (BLOG-03): 예약어가 아니거나, 관리자의 `notice`. */
export function mayUseSlug(slug: string, role: string): boolean {
  return !isReserved(slug) || (role === "admin" && slug === NOTICE_SLUG);
}
