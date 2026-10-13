import { describe, expect, it } from "vitest";
import { loginHref, NEXT_MAX, safeNext } from "@/lib/safe-next";

describe("safeNext (로그인 뒤 돌아갈 주소)", () => {
  it("이 사이트 안의 /… 주소는 그대로", () => {
    for (const v of ["/", "/@demo/12", "/@demo/12#comments", "/@demo?category=3&page=2", "/feed/following", "/tags/%ED%9A%8C%EA%B3%A0"]) expect(safeNext(v)).toBe(v);
  });
  it("다른 사이트로 가거나 이상한 값은 null", () => {
    const bad = [
      "",
      "//evil.com",
      "///evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "\\\\evil.com",
      "https://evil.com",
      "http:/evil.com",
      "javascript:alert(1)",
      "evil.com",
      "@demo",
      "/\t/evil.com",
      "/\n/evil.com",
      "/\r\n/evil.com",
      " /@demo",
      `/${"a".repeat(NEXT_MAX)}`,
      // 점 경로를 풀면 //evil.com
      "/..//evil.com",
      "/.//evil.com",
      "/%2e%2e//evil.com",
      "/%2e//evil.com",
      "/a/..//evil.com",
      "/@demo/../..//evil.com",
      "/.//evil.com/x?y#z",
      undefined,
      null,
      ["/@demo"],
      42,
    ];
    for (const v of bad) expect(safeNext(v), JSON.stringify(v)).toBeNull();
  });
  it("한 번 거른 값을 다시 걸러도 같다", () => {
    for (const v of ["/@demo/12#comments", "/a/../@demo", "/?next=/..//evil.com", "/tags/%ED%9A%8C%EA%B3%A0"]) {
      const once = safeNext(v);
      expect(once).not.toBeNull();
      expect(safeNext(once)).toBe(once);
    }
  });
  it("점 경로는 정리된 주소로", () => {
    expect(safeNext("/a/../@demo")).toBe("/@demo");
    expect(safeNext("/./@demo")).toBe("/@demo");
  });
});

describe("loginHref", () => {
  it("돌아올 주소를 붙인 첫 화면 주소", () => {
    expect(loginHref("/@demo/12#comments")).toBe("/?next=%2F%40demo%2F12%23comments");
    expect(loginHref("/")).toBe("/");
    expect(safeNext(decodeURIComponent(loginHref("/@demo/12#comments").slice("/?next=".length)))).toBe("/@demo/12#comments");
  });
});
