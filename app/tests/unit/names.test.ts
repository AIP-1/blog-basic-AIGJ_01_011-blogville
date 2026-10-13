import { describe, expect, it } from "vitest";
import { checkSignUp, AUTH_ERRORS } from "@/lib/auth-rules";
import { isReserved, mayUseSlug, normalizeName, NOTICE_SLUG, RESERVED_NAMES } from "@/lib/names";

const ok = { username: "tester1", password: "password1", passwordConfirm: "password1", blogTitle: "tester1의 블로그" };

describe("names", () => {
  it("앞뒤 공백을 지우고 소문자로", () => expect(normalizeName("  JinHaeng ")).toBe("jinhaeng"));
  it("예약어 21개", () => {
    expect(RESERVED_NAMES.size).toBe(21);
    expect(isReserved("write")).toBe(true);
    expect(isReserved("tester1")).toBe(false);
  });
  it("블로그 주소: 예약어는 못 쓰고, 관리자만 notice를 쓴다", () => {
    expect(NOTICE_SLUG).toBe("notice");
    expect(mayUseSlug("tester1", "user")).toBe(true);
    expect(mayUseSlug("notice", "user")).toBe(false);
    expect(mayUseSlug("notice", "admin")).toBe(true);
    expect(mayUseSlug("town", "admin")).toBe(false);
    expect(mayUseSlug("admin", "admin")).toBe(false);
  });
});

describe("checkSignUp", () => {
  it("올바른 입력", () => expect(checkSignUp(ok)).toBeNull());
  it("대문자 아이디는 소문자로 보고 통과", () => expect(checkSignUp({ ...ok, username: "Tester1" })).toBeNull());
  it.each([
    [{ username: "abc" }, AUTH_ERRORS.usernameFormat],
    [{ username: "has-dash" }, AUTH_ERRORS.usernameFormat],
    [{ password: "short", passwordConfirm: "short" }, AUTH_ERRORS.passwordTooShort],
    [{ password: "a".repeat(65), passwordConfirm: "a".repeat(65) }, AUTH_ERRORS.passwordTooLong],
    [{ passwordConfirm: "different" }, AUTH_ERRORS.passwordMismatch],
    [{ blogTitle: "   " }, "블로그 이름을 적어 주세요"],
    [{ blogTitle: "가".repeat(41) }, "블로그 이름은 40자까지예요"],
    [{ username: "admin" }, AUTH_ERRORS.reserved],
  ])("%o → %s", (patch, error) => expect(checkSignUp({ ...ok, ...patch })).toBe(error));
  it("처음 걸린 문구 하나만 (폼 순서)", () =>
    expect(checkSignUp({ username: "x", password: "1", passwordConfirm: "2", blogTitle: "" })).toBe(AUTH_ERRORS.usernameFormat));
});
