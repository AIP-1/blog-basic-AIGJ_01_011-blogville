import { describe, expect, it } from "vitest";
import { parseRadius, placeKind, radiusLabel } from "@/lib/food-kind";
import { areaWords, isRelevantReview, relevantReviews } from "@/lib/food-relevance";

describe("맛집 분류 (placeKind)", () => {
  it.each([
    ["한식 > 국밥", "", "meal"],
    ["간식 > 제과,베이커리", "", "cafe"],
    ["카페 > 커피전문점", "", "cafe"],
    ["테마카페 > 보드카페", "", "cafe"],
    ["카페,디저트>베이커리", "", "cafe"],
    ["간식 > 아이스크림", "", "cafe"],
    ["술집 > 호프,요리주점", "", "bar"],
    ["일본식주점 > 이자카야", "", "bar"],
    ["양식 > 이탈리안", "", "meal"],
    ["", "우리동네 포차", "bar"],
    ["", "성심당 베이커리", "cafe"],
  ] as const)("%s %s → %s", (cat, name, want) => expect(placeKind(cat, name)).toBe(want));
  it("거리는 300·500·1000·2000만, 아니면 500", () => {
    expect(parseRadius("2000")).toBe(2000);
    expect(parseRadius("999")).toBe(500);
    expect(parseRadius(undefined)).toBe(500);
    expect(radiusLabel(300)).toBe("300m");
    expect(radiusLabel(2000)).toBe("2km");
  });
});

describe("후기 거르기 (isRelevantReview)", () => {
  const mafia = { name: "마피아", address: "광주 동구 금남로 18", category: "양식 > 피자" };
  const r = (title: string, summary = "") => ({ title, summary });
  it("동네 낱말", () => expect(areaWords("광주 동구 금남로 18")).toEqual(["동구", "금남로", "광주"]));
  it("짧은 이름은 동네와 먹은 이야기가 둘 다 있어야", () => {
    expect(isRelevantReview(r("광주 동구 마피아 피자 맛집 후기", "금남로 근처 웨이팅"), mafia)).toBe(true);
    expect(isRelevantReview(r("마피아 게임 규칙 정리", "친구들이랑 보드게임"), mafia)).toBe(false);
    expect(isRelevantReview(r("영화 마피아 리뷰", "결말 해석"), mafia)).toBe(false);
    expect(isRelevantReview(r("마피아 맛있어요", "피자 먹고 왔어요"), mafia)).toBe(false); // 동네가 없음
  });
  it("이름이 없거나 광고·스팸이면 뺀다", () => {
    const place = { name: "영미오리탕", address: "광주 북구 경양로 126", category: "한식 > 오리" };
    expect(isRelevantReview(r("영미오리탕 다녀왔어요", "국물이 진해요"), place)).toBe(true);
    expect(isRelevantReview(r("영미 오리탕 북구 맛집"), place)).toBe(true); // 띄어쓰기 달라도
    expect(isRelevantReview(r("광주 오리탕 맛집 BEST 5"), place)).toBe(false);
    expect(isRelevantReview(r("영미오리탕 근처 아파트 분양 정보"), place)).toBe(false);
    expect(relevantReviews([r("영미오리탕 후기", "맛있"), r("다른 글")], place)).toHaveLength(1);
  });
  it("지점명은 빼고 본다", () => {
    const place = { name: "스타벅스 금남로점", address: "광주 동구 금남로 1", category: "카페 > 커피전문점" };
    expect(isRelevantReview(r("스타벅스 금남로 신메뉴", "커피 마심"), place)).toBe(true);
  });
});

describe("넓은 반경 나누기 (gridRects)", () => {
  it("n×n 칸, 칸은 반경을 덮는다", async () => {
    const { gridRects } = await import("@/server/food");
    const rects = gridRects({ lat: 35.147, lng: 126.915 }, 2000, 3);
    expect(rects).toHaveLength(9);
    const [x1, y1] = rects[0].split(",").map(Number);
    const [, , x2, y2] = rects[8].split(",").map(Number);
    expect(y1).toBeCloseTo(35.147 - 2000 / 111000, 4);
    expect(y2).toBeCloseTo(35.147 + 2000 / 111000, 4);
    expect(x1).toBeLessThan(126.915);
    expect(x2).toBeGreaterThan(126.915);
  });
});

describe("뺀 까닭 (reviewVerdict)", () => {
  it("광고·이름 없음·다른 이야기", async () => {
    const { reviewVerdict } = await import("@/lib/food-relevance");
    const mafia = { name: "마피아", address: "광주 동구 금남로 18", category: "양식 > 피자" };
    expect(reviewVerdict({ title: "마피아 근처 분양", summary: "" }, mafia)).toEqual({ keep: false, reason: "spam" });
    expect(reviewVerdict({ title: "광주 피자 맛집", summary: "" }, mafia)).toEqual({ keep: false, reason: "no-name" });
    expect(reviewVerdict({ title: "마피아 게임", summary: "보드게임" }, mafia)).toEqual({ keep: false, reason: "off-topic" });
    expect(reviewVerdict({ title: "동구 마피아 피자 후기", summary: "" }, mafia)).toEqual({ keep: true });
  });
});

describe("다른 곳 후기 (parseKakaoReviews · reviewKey)", () => {
  it("카카오(다음) 블로그·카페 → 후기, 한국 날짜, https 썸네일", async () => {
    const { parseKakaoReviews } = await import("@/lib/food");
    const [r] = parseKakaoReviews(
      { documents: [{ title: "<b>마피아</b> 후기", contents: "맛있&amp;좋아", url: "https://a.tistory.com/1", blogname: "에이", thumbnail: "http://t1.daumcdn.net/x.jpg", datetime: "2026-10-13T20:00:00.000+00:00" }] },
      "daum",
    );
    expect(r).toMatchObject({ title: "마피아 후기", summary: "맛있&좋아", blogger: "에이", date: "2026-10-14", image: "https://t1.daumcdn.net/x.jpg", source: "daum" });
    expect(parseKakaoReviews({ documents: [{ title: "x", url: "javascript:1" }] }, "cafe")).toEqual([]);
  });
  it("네이버 블로그 PC·모바일 주소는 같은 글", async () => {
    const { reviewKey } = await import("@/lib/food");
    expect(reviewKey("https://blog.naver.com/abc/1234")).toBe(reviewKey("https://m.blog.naver.com/abc/1234?x=1"));
    expect(reviewKey("https://www.a.tistory.com/1/")).toBe("a.tistory.com/1");
  });
});

describe("통합특별시 주소 (shortCity · areaOf)", () => {
  it("전남광주통합특별시는 구에 따라 광주/전남, 블로그 검색용 시·구", async () => {
    const { shortCity, areaOf } = await import("@/lib/food");
    expect(shortCity("전남광주통합특별시 서구 상무오월로15번길 28-15")).toBe("광주 서구 상무오월로15번길 28-15");
    expect(shortCity("전남광주통합특별시 광산구 첨단로 1")).toBe("광주 광산구 첨단로 1");
    expect(shortCity("전남광주통합특별시 순천시 연향동 1")).toBe("전남 순천시 연향동 1");
    expect(areaOf("전남광주통합특별시 동구 금남로 18")).toBe("광주 동구");
    expect(shortCity("광주광역시 북구 경양로 126")).toBe("광주 북구 경양로 126");
    expect(shortCity("강원특별자치도 강릉시 교동 1")).toBe("강원 강릉시 교동 1");
  });
});

describe("후기 거르기 강화 (마피아 실제 사례)", () => {
  const mafia = { name: "마피아", address: "광주 서구 상무오월로15번길 28-15", category: "양식 > 피자", phone: "0507-1424-1778" };
  const v = async (title: string, summary: string) => (await import("@/lib/food-relevance")).isRelevantReview({ title, summary }, mafia);
  it.each([
    ["[광주] 광주 쌍촌동 맛집 마피아 후기", "짝궁이랑 피맥이 땡겨서 방문한 쌍촌동 맛집 마피아 후기 입니다", true],
    ["쌍촌동 맛집 마피아 상무지구 피자 크림파스타 후기", "마피아 전남광주통합특별시 서구 상무오월로15번길 28-15", true],
    ["상무지구 데이트", "마피아 0507-1424-1778 영업시간 화-목", true],
    ["20260823 광주 마피아게임 연극 기분좋은극장 후기", "보고 싶었던 마피아 게임 연극! 상무지구 기분좋은극장", false],
    ["영화 gpt", "이민사회, 마피아, 가족 죽은 시인의 사회 1989 미국 교육문화", false],
    ["[2026청년정책] 광주 서구 청년 축제 무한도ZONE", "슈가토끼와 함께하는 마피아 게임으로 진행되었습니다! 서구 청년크리에이터단", false],
    ["전남광주 2026년 서구 청년 축제 참여 솔직후기", "공연 관람과 마피아게임은 참여 못했지만 무료", false],
    ["기어이 기적이 찾아오는 영화처럼", "스플랜더 했는데 제가이겼습니다. 마피아도 하고 언니들 화투치는거 구경도 하고", false],
  ] as const)("%s → %s", async (title, summary, want) => expect(await v(title, summary)).toBe(want));
});

describe("후기 거르기 v3 (짧은 이름 낱말 경계·다른 업종)", () => {
  const imp = () => import("@/lib/food-relevance");
  it("짧은 이름은 더 긴 낱말 속이면 아님", async () => {
    const { isRelevantReview } = await imp();
    const garden = { name: "정원", address: "전남 순천시 연향동 1", category: "한식 > 백반" };
    expect(isRelevantReview({ title: "순천만국가정원맛집 도원경 꼬막정식", summary: "" }, garden)).toBe(false);
    expect(isRelevantReview({ title: "순천 정원 백반 맛집 다녀왔어요", summary: "" }, garden)).toBe(true);
    const spring = { name: "봄", address: "광주 서구 상무대로 1", category: "카페" };
    expect(isRelevantReview({ title: "광천동 점심 맛집 고향에봄", summary: "" }, spring)).toBe(false);
  });
  it("제목이 다른 업종이고 이름이 요약에만 있으면 뺀다", async () => {
    const { isRelevantReview } = await imp();
    const place = { name: "고향집뚝배기", address: "전남 여수시 학동 1", category: "한식 > 찌개" };
    expect(isRelevantReview({ title: "여수 원네일 | 영롱함 그 자체! 여수 네일샵", summary: "고향집뚝배기 맛집 옆 건물" }, place)).toBe(false);
    expect(isRelevantReview({ title: "[여수 맛집] 아이랑 가기 좋은 식당 '고향집뚝배기' 내돈내산 후기", summary: "" }, place)).toBe(true);
  });
});

describe("후기 거르기 v4 (두 글자 이하 흔한 낱말 이름)", () => {
  it("정원(한정식)·봄(호프): 분류어·따옴표·○○ 식당일 때만", async () => {
    const { isRelevantReview } = await import("@/lib/food-relevance");
    const garden = { name: "정원", address: "전남 순천시 해룡면 매안로 137", category: "한식 > 한정식" };
    expect(isRelevantReview({ title: "순천 미각당 ㅣ 순천만 정원박람회 근처 게장맛집", summary: "" }, garden)).toBe(false);
    expect(isRelevantReview({ title: "순천 해룡면 한정식 '정원' 상견례 후기", summary: "" }, garden)).toBe(true);
    expect(isRelevantReview({ title: "순천 정원 한정식 다녀왔어요", summary: "" }, garden)).toBe(true);
    const spring = { name: "봄", address: "광주 서구 화개중앙로86번길 1", category: "술집 > 호프,요리주점" };
    expect(isRelevantReview({ title: "광주 서구 봄 신메뉴 카페 투어", summary: "봄 맞이 딸기" }, spring)).toBe(false);
    expect(isRelevantReview({ title: "광주 화정동 술집 [봄] 요리주점 후기", summary: "" }, spring)).toBe(true);
  });
});

describe("후기 거르기 v5 (체인 다른 지점·시공 글)", () => {
  it("상무초밥 광주 가게에 신촌점·간판 시공 글은 빼고 광주 글은 남긴다", async () => {
    const { isRelevantReview } = await import("@/lib/food-relevance");
    const p = { name: "상무초밥 광주본점", address: "광주 서구 상무중앙로 1", category: "일식 > 초밥,롤" };
    expect(isRelevantReview({ title: "신촌 저녁 맛집 '상무초밥 신촌점' 스시 사시미정식 혼밥 후기", summary: "" }, p)).toBe(false);
    expect(isRelevantReview({ title: "광주 상무초밥 전자메뉴판 설치｜LG DID 3대 천장형 디스플레이 시공", summary: "" }, p)).toBe(false);
    expect(isRelevantReview({ title: "광주 상무지구 초밥 맛집 상무초밥 점심 특선", summary: "" }, p)).toBe(true);
    const branch = { name: "상무초밥 상무점", address: "광주 서구 상무중앙로 1", category: "일식 > 초밥,롤" };
    expect(isRelevantReview({ title: "광주 상무초밥 상무점 런치 후기", summary: "" }, branch)).toBe(true);
  });
});
