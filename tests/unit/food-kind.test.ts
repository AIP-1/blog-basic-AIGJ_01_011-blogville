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
  it("동네 낱말", () => expect(areaWords("광주 동구 금남로 18")).toEqual(["동구", "금남로"]));
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
