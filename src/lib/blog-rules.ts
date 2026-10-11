import { codePointLength } from "./text";

export const BLOG_TITLE_MAX = 40;
export const BLOG_INTRO_MAX = 160;
export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

export const BLOG_ERRORS = {
  titleEmpty: "블로그 이름을 적어 주세요",
  titleTooLong: "블로그 이름은 40자까지예요",
  introTooLong: "소개는 160자까지예요",
  slugFormat: "주소는 영문 소문자, 숫자, _ 로 3~20자예요",
  slugReserved: "이 주소는 쓸 수 없어요",
  slugTaken: "이미 있는 주소예요",
  nicknameTooShort: "닉네임은 2자 이상이에요",
  nicknameTooLong: "닉네임은 20자까지예요",
  nicknameTaken: "이미 있는 닉네임이에요",
  saved: "저장했어요 ✓",
} as const;

/** 블로그 이름: 앞뒤 공백을 지운 뒤 1~40자. 오류 문구 또는 null. */
export function checkBlogTitle(title: string): string | null {
  const value = title.trim();
  if (value.length === 0) return BLOG_ERRORS.titleEmpty;
  if (codePointLength(value) > BLOG_TITLE_MAX) return BLOG_ERRORS.titleTooLong;
  return null;
}

export function checkBlogIntro(intro: string): string | null {
  return codePointLength(intro.trim()) > BLOG_INTRO_MAX ? BLOG_ERRORS.introTooLong : null;
}

export function checkNickname(nickname: string): string | null {
  const length = codePointLength(nickname.trim());
  if (length < NICKNAME_MIN) return BLOG_ERRORS.nicknameTooShort;
  if (length > NICKNAME_MAX) return BLOG_ERRORS.nicknameTooLong;
  return null;
}

/** 가입 폼이 채워 두는 기본 블로그 이름 */
export function defaultBlogTitle(username: string): string {
  return `${username}의 블로그`;
}
