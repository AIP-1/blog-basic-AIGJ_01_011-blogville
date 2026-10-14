import { describe, expect, it } from "vitest";
import {
  countBuzz,
  countsAsBuzz,
  coreName,
  interestKeywords,
  isAdLike,
  isFoodPlace,
  isRegionCandidate,
  isRising,
  rankRegion,
  summarizeInterest,
  type RankedPlace,
} from "@/lib/food-quality";
import type { FoodReview } from "@/lib/food";

const place = (
  name: string,
  category: string,
  address = "서울 용산구 한강대로 23",
) => ({ name, category, address });

describe("지역 인기 후보 거르기", () => {
  it("백화점·쇼핑몰은 뺀다", () => {
    expect(isFoodPlace(place("아이파크몰 용산점", "쇼핑,유통>쇼핑몰"))).toBe(
      false,
    );
    expect(isFoodPlace(place("NC백화점 송파점", "쇼핑,유통>백화점"))).toBe(
      false,
    );
    expect(isFoodPlace(place("롯데백화점 본점", ""))).toBe(false);
    expect(isFoodPlace(place("그랜드하얏트 호텔", "숙박>호텔"))).toBe(false);
  });
  it("식당·카페·디저트는 남긴다", () => {
    expect(isFoodPlace(place("몽탄", "한식>육류,고기요리"))).toBe(true);
    expect(isFoodPlace(place("마피아", "양식>이탈리아음식"))).toBe(true);
    expect(isFoodPlace(place("런던베이글뮤지엄", "카페,디저트>베이글"))).toBe(
      true,
    );
    expect(isFoodPlace(place("어느 집", ""))).toBe(true);
  });
  it("큰 체인은 지역 인기에서 뺀다", () => {
    expect(
      isRegionCandidate(place("스타벅스 한국프레스센터점", "카페,디저트>카페")),
    ).toBe(false);
    expect(
      isRegionCandidate(place("메가MGC커피 용산점", "카페,디저트>카페")),
    ).toBe(false);
    expect(
      isRegionCandidate(place("맥도날드 용산역점", "패스트푸드>햄버거")),
    ).toBe(false);
    expect(isRegionCandidate(place("오복수산", "일식>일식당"))).toBe(true);
  });
});

const review = (
  title: string,
  summary = "",
  date = "2026-10-10",
  blogger = "a",
): FoodReview => ({
  title,
  summary,
  date,
  blogger,
  url: `https://x/${blogger}/${title}`,
});
const mafia = place(
  "마피아 본점",
  "양식>이탈리아음식",
  "서울 성동구 성수동 1",
);

describe("후기 수 세기", () => {
  it("지점 이름을 떼고 비교한다", () => {
    expect(coreName("영미오리탕 본점")).toBe("영미오리탕");
    expect(coreName("스타벅스 한국프레스센터점")).toBe("스타벅스");
  });
  it("체험단·협찬 글은 광고로 본다", () => {
    expect(
      isAdLike(
        review("마피아 성수 파스타", "업체로부터 식사를 제공받아 작성했어요"),
      ),
    ).toBe(true);
    expect(isAdLike(review("마피아 성수 체험단 후기"))).toBe(true);
    expect(isAdLike(review("마피아 성수 내돈내산 파스타"))).toBe(false);
  });
  it("가게 이야기가 아닌 글(게임 마피아 등)은 세지 않는다", () => {
    expect(
      countsAsBuzz(
        review("마피아 게임 규칙 정리", "직업 배분과 밤 시간 진행"),
        mafia,
      ),
    ).toBe(false);
    expect(countsAsBuzz(review("영화 마피아 리뷰"), mafia)).toBe(false);
    expect(
      countsAsBuzz(
        review("성수동 마피아 파스타 맛집", "트러플 파스타가 맛있었어요"),
        mafia,
      ),
    ).toBe(true);
    expect(
      countsAsBuzz(review("성수동 데이트", "마피아에서 저녁 먹고 산책"), mafia),
    ).toBe(true);
  });
  it("한 블로거는 한 번, 30일 안의 진짜 후기만", () => {
    const list = [
      review("성수동 마피아 맛집", "", "2026-10-10", "a"),
      review("마피아 성수동 재방문 맛집", "", "2026-10-12", "a"),
      review("마피아 성수동 맛집", "", "2026-10-11", "b"),
      review("마피아 성수 맛집 체험단", "", "2026-10-11", "c"),
      review("마피아 게임", "", "2026-10-11", "d"),
      review("마피아 성수동 맛집", "", "2026-08-01", "e"),
    ];
    expect(countBuzz(list, mafia, "2026-10-14")).toBe(2);
  });
});

describe("검색 관심도", () => {
  it("짧은 이름은 도시를 붙인 말만 쓴다", () => {
    expect(interestKeywords(mafia)).toEqual(["서울 마피아"]);
    expect(
      interestKeywords(
        place("런던베이글뮤지엄 안국점", "카페", "서울 종로구 북촌로4길 20"),
      ),
    ).toEqual([
      "런던베이글뮤지엄 안국점",
      "서울 런던베이글뮤지엄",
      "런던베이글뮤지엄",
    ]);
  });
  it("요즘 2주가 그 전보다 30% 넘게 오르면 ↑", () => {
    const s = summarizeInterest([10, 10, 10, 10, 10, 10, 20, 22]);
    expect(isRising(s)).toBe(true);
    expect(isRising(summarizeInterest([10, 10, 10, 10, 10, 10, 10, 11]))).toBe(
      false,
    );
    expect(isRising(summarizeInterest([0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
  });
  it("후기 수와 관심도를 반씩 섞고, 관심도가 없으면 후기 수만", () => {
    const p = (
      id: string,
      recent: number,
      interest: number | null,
    ): RankedPlace => ({
      id,
      name: id,
      category: "",
      address: "",
      phone: "",
      mapUrl: "",
      lat: null,
      lng: null,
      distance: null,
      recent,
      interest,
      rising: false,
      kind: "meal",
    });
    expect(
      rankRegion([p("a", 10, 0.1), p("b", 6, 2), p("c", 8, 0.5)]).map(
        (x) => x.id,
      ),
    ).toEqual(["b", "a", "c"]);
    expect(
      rankRegion([p("a", 3, null), p("b", 9, null)]).map((x) => x.id),
    ).toEqual(["b", "a"]);
  });
});

describe("지역 인기 동네", () => {
  it("고른 도시의 동네만 받는다", async () => {
    const { isFoodArea, FOOD_AREAS, FOOD_REGIONS } = await import("@/lib/food");
    expect(isFoodArea("서울", "성수")).toBe(true);
    expect(isFoodArea("부산", "성수")).toBe(false);
    expect(isFoodArea("서울", "<script>")).toBe(false);
    expect(isFoodArea("없는도시", "성수")).toBe(false);
    for (const r of FOOD_REGIONS) expect(FOOD_AREAS[r].length).toBeGreaterThan(0);
  });
});
