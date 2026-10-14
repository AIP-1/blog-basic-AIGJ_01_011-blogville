import { describe, expect, it } from "vitest";
import { bestKeyword, parseKeywords, parseTrend, summarizeTrend, trendRequest } from "@/lib/keyword-trend";

describe("키워드 도우미", () => {
  it("후보를 쉼표로 나누고 #·겹친 것·빈 칸을 빼고 5개까지", () => {
    expect(parseKeywords("#가을 캠핑, 캠핑장비 ,가을 캠핑,, a,b,c,d")).toEqual(["가을 캠핑", "캠핑장비", "a", "b", "c"]);
    expect(parseKeywords(" , ")).toBeNull();
    expect(parseKeywords("가".repeat(21))).toBeNull();
  });

  it("요청은 어제까지, 기간 길이만큼, 단어마다 한 묶음", () => {
    const body = trendRequest(["캠핑", "등산"], "m1", "2026-10-14");
    expect(body).toMatchObject({ startDate: "2026-09-14", endDate: "2026-10-13", timeUnit: "date" });
    expect(body.keywordGroups).toEqual([
      { groupName: "캠핑", keywords: ["캠핑"] },
      { groupName: "등산", keywords: ["등산"] },
    ]);
    expect(trendRequest(["x"], "y1", "2026-10-14")).toMatchObject({ startDate: "2025-10-14", timeUnit: "week" });
  });

  it("응답을 넣은 순서대로 읽고 빠진 기간은 0", () => {
    const json = {
      results: [
        { title: "등산", data: [{ period: "2026-10-01", ratio: 50 }] },
        { title: "캠핑", data: [{ period: "2026-10-01", ratio: 100 }, { period: "2026-10-02", ratio: 80.5 }] },
      ],
    };
    expect(parseTrend(json, ["캠핑", "등산"])).toEqual([
      { keyword: "캠핑", points: [{ period: "2026-10-01", ratio: 100 }, { period: "2026-10-02", ratio: 80.5 }] },
      { keyword: "등산", points: [{ period: "2026-10-01", ratio: 50 }, { period: "2026-10-02", ratio: 0 }] },
    ]);
    expect(parseTrend({ nope: 1 }, ["a"])).toBeNull();
  });

  it("평균·요즘 흐름·가장 많이 찾는 말", () => {
    const pts = (xs: number[]) => xs.map((ratio, i) => ({ period: `2026-10-${String(i + 1).padStart(2, "0")}`, ratio }));
    const summary = summarizeTrend([
      { keyword: "오름", points: pts([10, 10, 20, 40]) },
      { keyword: "내림", points: pts([80, 60, 40, 20]) },
      { keyword: "없음", points: pts([0, 0, 0, 0]) },
    ]);
    expect(summary.map((s) => s.change)).toEqual(["up", "down", "flat"]);
    expect(summary[0].changePct).toBe(300);
    expect(bestKeyword(summary)).toBe("내림");
    expect(bestKeyword(summarizeTrend([{ keyword: "없음", points: pts([0]) }]))).toBeNull();
  });
});
