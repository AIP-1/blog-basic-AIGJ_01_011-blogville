import { describe, expect, it } from "vitest";
import { reviewArea, shortCity } from "@/lib/food";
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

describe("전남 시·군 주소", () => {
  it("도 이름을 줄이고 통합 시의 옛 전남 시·군은 '전남'으로", () => {
    expect(shortCity("전라남도 목포시 평화로 1")).toBe("전남 목포시 평화로 1");
    expect(shortCity("전남광주통합특별시 목포시 평화로 1")).toBe("전남 목포시 평화로 1");
    expect(shortCity("전남광주통합특별시 광산구 첨단로 1")).toBe("광주 광산구 첨단로 1");
    expect(shortCity("경기도 수원시 영통구 광교로 1")).toBe("경기 수원시 영통구 광교로 1");
  });

  it("후기 검색 동네는 블로거가 쓰는 말로", () => {
    expect(reviewArea("전남 목포시 평화로 1")).toBe("목포");
    expect(reviewArea("전남 해남군 해남읍 1")).toBe("해남");
    expect(reviewArea("광주 서구 상무오월로 1")).toBe("광주 서구");
    expect(reviewArea("서울 성동구 연무장길 1")).toBe("서울 성동구");
  });

  it("'목포 ○○' 글도 그 식당 이야기로 본다", () => {
    const p = { name: "만호", address: "전남 목포시 해안로 1", category: "한식" };
    expect(areaWords(p.address)).toContain("목포");
    expect(isRelevantReview({ title: "목포 만호 맛집 후기", summary: "꽃게 맛있" }, p)).toBe(true);
  });
});
