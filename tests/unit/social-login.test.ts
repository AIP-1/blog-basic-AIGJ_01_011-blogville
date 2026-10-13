import { describe, expect, it } from "vitest";
import {
  enabledProviders,
  isSocialProvider,
  linkErrorMessage,
  providerKeys,
  signInErrorMessage,
  SOCIAL_MESSAGES,
  socialEmail,
} from "@/lib/social-login";

describe("소셜 로그인 키 (AUTH-01)", () => {
  it("키가 하나도 없으면 아무 서비스도 켜지 않는다", () => {
    expect(enabledProviders({})).toEqual([]);
  });

  it("ID와 비밀값이 둘 다 있는 서비스만 켠다", () => {
    const env = { KAKAO_CLIENT_ID: "k", KAKAO_CLIENT_SECRET: "s", NAVER_CLIENT_ID: "n", GOOGLE_CLIENT_SECRET: "g" };
    expect(enabledProviders(env)).toEqual([{ id: "kakao", label: "카카오" }]);
  });

  it("빈칸만 있는 값은 없는 것으로 본다", () => {
    expect(providerKeys("google", { GOOGLE_CLIENT_ID: "  ", GOOGLE_CLIENT_SECRET: "x" })).toBeNull();
    expect(providerKeys("google", { GOOGLE_CLIENT_ID: " id ", GOOGLE_CLIENT_SECRET: "x" })).toEqual({ clientId: "id", clientSecret: "x" });
  });

  it("세 서비스가 다 있으면 카카오·네이버·Google 순서", () => {
    const env = Object.fromEntries(["KAKAO", "NAVER", "GOOGLE"].flatMap((p) => [[`${p}_CLIENT_ID`, "a"], [`${p}_CLIENT_SECRET`, "b"]]));
    expect(enabledProviders(env).map((p) => p.id)).toEqual(["kakao", "naver", "google"]);
  });

  it("서비스 이름은 세 가지만", () => {
    expect(isSocialProvider("kakao")).toBe(true);
    expect(isSocialProvider("credential")).toBe(false);
    expect(isSocialProvider(null)).toBe(false);
  });
});

describe("소셜 계정 이메일 자리", () => {
  it("아이디 회원의 이메일(@users.blogville.invalid)과 겹치지 않는다", () => {
    expect(socialEmail("kakao", 1234)).toBe("kakao_1234@kakao.blogville.invalid");
    expect(socialEmail("google", "abc")).not.toMatch(/@users\.blogville\.invalid$/);
  });
});

describe("돌아왔을 때 문구", () => {
  it("연동 안 된 계정으로 로그인하면 연동 안내", () => {
    for (const code of ["signup_disabled", "account_not_linked", "email_not_found"]) {
      expect(signInErrorMessage(code)).toBe(SOCIAL_MESSAGES.notLinked);
    }
  });

  it("취소 같은 다른 코드는 문구 없이", () => {
    expect(signInErrorMessage("access_denied")).toBeNull();
    expect(signInErrorMessage(undefined)).toBeNull();
  });

  it("다른 회원에게 연동된 계정이면 그렇다고 알린다", () => {
    expect(linkErrorMessage("account_already_linked_to_different_user")).toBe(SOCIAL_MESSAGES.linkedToOther);
    expect(linkErrorMessage("invalid_code")).toBe(SOCIAL_MESSAGES.linkFailed);
    expect(linkErrorMessage("access_denied")).toBeNull();
  });
});
