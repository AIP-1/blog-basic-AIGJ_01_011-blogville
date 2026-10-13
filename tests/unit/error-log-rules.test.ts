import { describe, expect, it } from "vitest";
import { ERROR_LIMITS, groupKey, parseErrorRange, rangeSince, redact, secretValues, stripQuery, toErrorEntry, trimStack, truncate } from "@/lib/error-log-rules";

describe("서버 오류 기록 규칙", () => {
  it("truncate: 넘으면 잘라 …를 붙이고 결과도 max자 이하", () => {
    expect(truncate("가나다", 5)).toBe("가나다");
    expect(truncate("가나다라마바", 4)).toBe("가나다…");
    expect(truncate("x".repeat(2000), 1000)).toHaveLength(1000);
  });

  it("stripQuery: 쿼리 문자열과 # 뒤를 뗀다", () => {
    expect(stripQuery("/reset?token=abc")).toBe("/reset");
    expect(stripQuery("/a/b#c")).toBe("/a/b");
    expect(stripQuery("/plain")).toBe("/plain");
  });

  it("groupKey: 같은 경로·같은 digest면 같고, digest가 없으면 메시지로 묶는다", () => {
    const a = { digest: "123", message: "x", routePath: "/a" };
    expect(groupKey(a)).toBe(groupKey({ ...a, message: "다른 메시지" }));
    expect(groupKey(a)).not.toBe(groupKey({ ...a, routePath: "/b" }));
    expect(groupKey(a)).not.toBe(groupKey({ ...a, digest: "456" }));
    const m = { digest: null, message: "시험 오류", routePath: "/a" };
    expect(groupKey(m)).toBe(groupKey({ ...m }));
    expect(groupKey(m)).not.toBe(groupKey({ ...m, message: "다른" }));
  });

  it("비밀 환경 값은 가리고, 스택은 앞 줄만 4000자 이하", () => {
    const secrets = secretValues({ BETTER_AUTH_SECRET: "supersecretvalue", NODE_ENV: "production", SHORT_KEY: "abc" });
    expect(secrets).toEqual(["supersecretvalue"]);
    expect(redact("연결 실패 supersecretvalue!", secrets)).toBe("연결 실패 [숨김]!");
    const stack = trimStack(Array.from({ length: 100 }, (_, i) => `    at f${i} (${"a".repeat(200)})`).join("\n"), secrets);
    expect(stack.split("\n").length).toBeLessThanOrEqual(ERROR_LIMITS.stackLines);
    expect(stack.length).toBeLessThanOrEqual(ERROR_LIMITS.stack);
  });

  it("toErrorEntry: 메시지·digest·경로(쿼리 없이)·브라우저를 담는다", () => {
    const err = Object.assign(new Error("시험 오류"), { digest: "999" });
    const e = toErrorEntry(err, { path: "/admin/errors/test?token=secret", method: "POST", headers: { "user-agent": "u".repeat(500) } }, { routePath: "/admin/errors/test", routeType: "route" });
    expect(e).toMatchObject({ digest: "999", message: "시험 오류", url: "/admin/errors/test", method: "POST", routePath: "/admin/errors/test", routeType: "route" });
    expect(e.userAgent).toHaveLength(ERROR_LIMITS.userAgent);
    expect(toErrorEntry("문자열", { path: "/", method: "GET", headers: {} }, {})).toMatchObject({ message: "문자열", digest: null, stack: null, userAgent: null });
  });

  it("기간: 모르는 값은 24시간, 전체는 시작 시각 없음", () => {
    expect(parseErrorRange("7d")).toBe("7d");
    expect(parseErrorRange("x")).toBe("24h");
    expect(rangeSince("all")).toBeNull();
    expect(rangeSince("24h", 86_400_000)!.getTime()).toBe(0);
  });
});
