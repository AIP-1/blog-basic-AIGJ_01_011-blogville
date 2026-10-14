import { describe, expect, it } from "vitest";
import { shortCity } from "@/lib/food";
import { areaWords, isRelevantReview } from "@/lib/food-relevance";

describe("통합 시 이름", () => {
  it("전남광주통합특별시를 블로그에 쓰는 '광주'로 줄인다", () => {
    expect(shortCity("전남광주통합특별시 서구 상무오월로15번길 28-15")).toBe(
      "광주 서구 상무오월로15번길 28-15",
    );
    expect(shortCity("광주광역시 동구 금남로 18")).toBe("광주 동구 금남로 18");
    expect(shortCity("서울특별시 성동구 연무장길 1")).toBe(
      "서울 성동구 연무장길 1",
    );
  });

  it("짧은 이름 식당도 '광주 ○○ 맛집' 글은 남긴다", () => {
    const p = {
      name: "마피아",
      address: "광주 서구 상무오월로15번길 28-15",
      category: "양식 > 피자",
    };
    expect(areaWords(p.address)).toContain("광주");
    expect(
      isRelevantReview(
        { title: "광주 마피아 맛집 다녀왔어요", summary: "피자가 맛있" },
        p,
      ),
    ).toBe(true);
    expect(
      isRelevantReview(
        { title: "마피아 게임 하는 법", summary: "보드게임 규칙" },
        p,
      ),
    ).toBe(false);
  });
});
