import { checkBlogTitle } from "./blog-rules";
import { isReserved, normalizeName, USERNAME_RE } from "./names";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

export const AUTH_ERRORS = {
  usernameFormat: "아이디는 영문 소문자, 숫자, _ 로 4~20자예요",
  passwordTooShort: "비밀번호는 8자 이상이에요",
  passwordTooLong: "비밀번호는 64자까지예요",
  passwordMismatch: "비밀번호가 서로 달라요",
  reserved: "이 아이디는 쓸 수 없어요",
  taken: "이미 있는 아이디예요",
  character: "고를 수 없는 캐릭터예요",
  signInEmpty: "아이디와 비밀번호를 적어 주세요",
  signInFailed: "아이디 또는 비밀번호가 맞지 않아요",
  locked: "로그인을 너무 많이 시도했어요. 5분 뒤에 다시 시도해 주세요",
  withdrawEmpty: "비밀번호를 적어 주세요",
  withdrawWrong: "비밀번호가 맞지 않아요",
  changeEmpty: "지금 비밀번호와 새 비밀번호를 적어 주세요",
  changeWrong: "지금 비밀번호가 맞지 않아요",
  changeSame: "지금과 다른 비밀번호를 적어 주세요",
  changed: "비밀번호를 바꿨어요",
} as const;

/** 비밀번호 바꾸기 입력 검사 (빈칸 → 새 비밀번호 길이 → 확인 → 같은 값). 지금 비밀번호가 맞는지는 서버에서 본다. */
export function checkPasswordChange(input: { current: string; next: string; confirm: string }): string | null {
  if (!input.current || !input.next) return AUTH_ERRORS.changeEmpty;
  if (input.next.length < PASSWORD_MIN) return AUTH_ERRORS.passwordTooShort;
  if (input.next.length > PASSWORD_MAX) return AUTH_ERRORS.passwordTooLong;
  if (input.next !== input.confirm) return AUTH_ERRORS.passwordMismatch;
  if (input.next === input.current) return AUTH_ERRORS.changeSame;
  return null;
}

export type SignUpInput = {
  username: string;
  password: string;
  passwordConfirm: string;
  blogTitle: string;
};

/** 가입 입력 검사 (폼 순서). 처음 걸린 문구 하나 또는 null. 겹침은 서버 트랜잭션에서 본다. */
export function checkSignUp(input: SignUpInput): string | null {
  const username = normalizeName(input.username);
  if (!USERNAME_RE.test(username)) return AUTH_ERRORS.usernameFormat;
  if (input.password.length < PASSWORD_MIN) return AUTH_ERRORS.passwordTooShort;
  if (input.password.length > PASSWORD_MAX) return AUTH_ERRORS.passwordTooLong;
  if (input.password !== input.passwordConfirm) return AUTH_ERRORS.passwordMismatch;
  const titleError = checkBlogTitle(input.blogTitle);
  if (titleError) return titleError;
  if (isReserved(username)) return AUTH_ERRORS.reserved;
  return null;
}
