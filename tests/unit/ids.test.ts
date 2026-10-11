import { describe, expect, it } from "vitest";
import { pageNumbers, parseId, parsePage } from "@/lib/ids";

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

describe("pageNumbers", () => {
  it("1페이지뿐이면 숨긴다", () => {
    expect(pageNumbers(1, 0)).toEqual([]);
    expect(pageNumbers(1, 1)).toEqual([]);
  });
  it("20페이지 중 10페이지는 1 … 8 9 10 11 12 … 20", () => {
    expect(pageNumbers(10, 20)).toEqual([1, "…", 8, 9, 10, 11, 12, "…", 20]);
  });
  it("처음·끝 근처와 한 칸만 비는 곳은 번호로 채운다", () => {
    expect(pageNumbers(1, 20)).toEqual([1, 2, 3, "…", 20]);
    expect(pageNumbers(4, 20)).toEqual([1, 2, 3, 4, 5, 6, "…", 20]);
    expect(pageNumbers(20, 20)).toEqual([1, "…", 18, 19, 20]);
    expect(pageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("마지막보다 큰 페이지면 처음과 끝만", () => {
    expect(pageNumbers(999, 2)).toEqual([1, 2]);
    expect(pageNumbers(999, 20)).toEqual([1, "…", 20]);
  });
});
