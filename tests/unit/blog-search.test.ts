import { describe, expect, it } from "vitest";
import { likePattern, parseSearchQuery, parseTagFilter } from "@/lib/blog-search";
import { previousDay, todayKST } from "@/lib/kst";

describe("parseSearchQuery (BLOG-09 ?s=)", () => {
  it("앞뒤 공백을 지우고 1~50자", () => {
    expect(parseSearchQuery("  여행 ")).toBe("여행");
    expect(parseSearchQuery("가".repeat(50))).toBe("가".repeat(50));
    expect(parseSearchQuery("😀".repeat(50))).toBe("😀".repeat(50));
  });
  it("비었거나 공백만이면 empty, 51자·없음·배열은 무시", () => {
    expect(parseSearchQuery("")).toBe("empty");
    expect(parseSearchQuery("   ")).toBe("empty");
    expect(parseSearchQuery("가".repeat(51))).toBeNull();
    expect(parseSearchQuery(undefined)).toBeNull();
    expect(parseSearchQuery(["a", "b"])).toBeNull();
  });
});

describe("parseTagFilter (?tag=)", () => {
  it("태그 저장 규칙대로 맞춘다", () => {
    expect(parseTagFilter("  Next  JS ")).toBe("next js");
    expect(parseTagFilter("")).toBeNull();
    expect(parseTagFilter("a".repeat(51))).toBeNull();
  });
});

describe("likePattern", () => {
  it("%·_·\\는 글자 그대로", () => {
    expect(likePattern("100%")).toBe("%100\\%%");
    expect(likePattern("a_b\\c")).toBe("%a\\_b\\\\c%");
  });
});

describe("todayKST·previousDay", () => {
  it("한국 시간 0시가 날짜 경계", () => {
    expect(todayKST(new Date("2026-10-10T14:59:59Z"))).toBe("2026-10-10");
    expect(todayKST(new Date("2026-10-10T15:00:00Z"))).toBe("2026-10-11");
  });
  it("달·해가 바뀌어도 하루 전", () => {
    expect(previousDay("2026-10-01")).toBe("2026-09-30");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
    expect(previousDay("2028-03-01")).toBe("2028-02-29");
  });
});
