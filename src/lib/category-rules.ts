import { codePointLength } from "./text";

export const CATEGORY_NAME_MAX = 20;

export const CATEGORY_ERRORS = {
  empty: "카테고리 이름을 적어 주세요",
  tooLong: "카테고리 이름은 20자까지예요",
  taken: "이미 있는 카테고리예요",
  invalid: "잘못된 요청이에요",
} as const;

export function checkCategoryName(name: string): string | null {
  const value = name.trim();
  if (value.length === 0) return CATEGORY_ERRORS.empty;
  if (codePointLength(value) > CATEGORY_NAME_MAX) return CATEGORY_ERRORS.tooLong;
  return null;
}
