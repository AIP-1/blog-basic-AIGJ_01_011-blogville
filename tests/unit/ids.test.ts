import { describe, expect, it } from "vitest";
import { parseId, parsePage } from "@/lib/ids";

describe("parseId", () => {
  it("숫자만 적힌 1~2147483647 정수만 받는다", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("2147483647")).toBe(2147483647);
  });
  it.each(["0", "-1", "abc", "2.5", "012", "1e1", "2147483648", "99999999999", " 1", ""])("%j는 무효", (v) => {
    expect(parseId(v)).toBeNull();
  });
  it("문자열이 아니면 무효", () => {
    expect(parseId(null)).toBeNull();
    expect(parseId(undefined)).toBeNull();
  });
});

describe("parsePage", () => {
  it("무효면 1페이지", () => {
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("99999999999999999999")).toBe(1);
    expect(parsePage("3")).toBe(3);
  });
});
