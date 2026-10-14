import { describe, expect, it } from "vitest";
import { bodyMatch, htmlText, roadWords } from "@/lib/food-place-match";

const mafia = { id: "123456", name: "마피아", address: "광주 서구 상무오월로15번길 28-15", phone: "0507-1424-1778", category: "양식 > 피자" };
const page = (body: string) => `<html><head><script>var x="상무오월로";</script></head><body><div class="se-main-container">${body}</div></body></html>`;
const filler = "오늘은 날씨가 정말 좋았어요. ".repeat(20);

describe("글 본문으로 식당 확인 (bodyMatch)", () => {
  it("도로명 낱말", () => expect(roadWords("광주 서구 상무오월로15번길 28-15")).toEqual(["상무오월로15번길", "상무오월로"]));
  it("본문 글자만 (스크립트 빼고, 지도 카드 data는 남김)", () => {
    expect(htmlText(page("<p>안녕&amp;하세요</p>"))).toBe("안녕&하세요");
    expect(htmlText(`<a data-linkdata='{"name":"마피아","address":"상무오월로"}'>지도</a>`)).toContain("상무오월로");
  });
  it("전화번호·도로명·지도 링크가 있으면 그 식당 후기", () => {
    expect(bodyMatch(page(`${filler}<p>마피아 050714241778 피자</p>`), mafia)).toBe("match");
    expect(bodyMatch(page(`${filler}<p>마피아 전남광주통합특별시 서구 상무오월로15번길 28-15 1층</p>`), mafia)).toBe("match");
    expect(bodyMatch(page(`${filler}<a href="https://place.map.kakao.com/123456">지도</a>`), mafia)).toBe("match");
  });
  it("이름만 지나가는 글(게임·연극·사회 이야기)은 뺀다", () => {
    expect(bodyMatch(page(`${filler}<p>언니들이랑 마피아도 하고 화투도 쳤어요</p>`), mafia)).toBe("mismatch");
    expect(bodyMatch(page(`${filler}<p>코믹추리연극 마피아 게임, 상무중앙로 90 기분좋은극장. 마피아 역할이 재밌었어요</p>`), mafia)).toBe("mismatch");
    expect(bodyMatch(page(`${filler}<p>이민사회, 마피아, 서구사회 이야기</p>`), mafia)).toBe("mismatch");
  });
  it("주소가 없어도 이름과 먹은 이야기가 여러 번이면 남긴다", () => {
    expect(bodyMatch(page(`${filler}<p>마피아 메뉴는 피자. 주문하고 웨이팅 조금. 마피아 또 갈래요 맛있었어요</p>`), mafia)).toBe("weak");
  });
  it("짧거나 못 읽은 글은 모른다", () => expect(bodyMatch("<p>마피아</p>", mafia)).toBe("unknown"));
});

describe("다른 지역 여행 글 (otherRegionTitle)", () => {
  it("광주 식당인데 제목이 강릉 여행이면 뺀다, 광주 이야기가 같이 있으면 둔다", async () => {
    const { otherRegionTitle } = await import("@/lib/food-place-match");
    const { areaWords } = await import("@/lib/food-relevance");
    const local = areaWords(mafia.address);
    expect(otherRegionTitle("7/29-31 강릉야호~", mafia, local)).toBe(true);
    expect(otherRegionTitle("오사카 여행 3일차", mafia, local)).toBe(true);
    expect(otherRegionTitle("강릉 다녀와서 광주 쌍촌동 마피아", mafia, local)).toBe(false);
    expect(otherRegionTitle("[광주] 광주 쌍촌동 맛집 마피아 후기", mafia, local)).toBe(false);
    expect(otherRegionTitle("공주님 생일 파티 마피아 피자", mafia, local)).toBe(false);
  });
});

describe("많이 올라온 순 세기 (countsAsBuzz)", () => {
  it("다른 지역 여행 글은 세지 않는다", async () => {
    const { countsAsBuzz } = await import("@/lib/food-quality");
    expect(countsAsBuzz({ title: "강릉 여행 마피아 피자 맛집", summary: "먹었어요" }, mafia)).toBe(false);
    expect(countsAsBuzz({ title: "광주 쌍촌동 마피아 피자 맛집", summary: "먹었어요" }, mafia)).toBe(true);
  });
});

describe("다른 지점·동네 글 (otherRegionTitle)", () => {
  it("광주 식당인데 신촌·세종 지점 글은 빼고, 서울 식당의 홍대 글은 둔다", async () => {
    const { otherRegionTitle } = await import("@/lib/food-place-match");
    const { areaWords } = await import("@/lib/food-relevance");
    const sangmu = { address: "광주 서구 상무중앙로 1" };
    const local = areaWords(sangmu.address);
    expect(otherRegionTitle("신촌 초밥 맛집 상무초밥 신촌점", sangmu, local)).toBe(true);
    expect(otherRegionTitle("세종 나성동 맛집 상무초밥", sangmu, local)).toBe(true);
    expect(otherRegionTitle("상무지구 상무초밥 점심", sangmu, local)).toBe(false);
    const seoul = { address: "서울 마포구 와우산로 1" };
    expect(otherRegionTitle("홍대 맛집 다녀옴", seoul, areaWords(seoul.address))).toBe(false);
    const merged = { address: "전남광주통합특별시 서구 상무오월로 1" };
    expect(otherRegionTitle("광주 상무지구 맛집", merged, areaWords(shortCityOf(merged.address)))).toBe(false);
  });
});
function shortCityOf(a: string) {
  return a.replace(/^전남광주통합특별시/, "광주");
}

describe("식당 이름 속 지역 낱말", () => {
  it("세종한정식은 세종 지역 글로 보지 않는다", async () => {
    const { otherRegionTitle } = await import("@/lib/food-place-match");
    const p = { name: "세종한정식", address: "광주 북구 우치로 1" };
    expect(otherRegionTitle("세종한정식 점심 후기", p, ["북구", "우치로", "광주"])).toBe(false);
  });
});

describe("서울 동네 이름 글", () => {
  it("광주 식당인데 '신촌 연세대 맛집'은 다른 지역", async () => {
    const { otherRegionTitle } = await import("@/lib/food-place-match");
    const { areaWords } = await import("@/lib/food-relevance");
    const p = { name: "상무초밥", address: "광주 서구 상무중앙로 1" };
    expect(otherRegionTitle("신촌 연세대 맛집 초밥 상무초밥", p, areaWords(p.address))).toBe(true);
    expect(otherRegionTitle("건대 맛집 상무초밥", p, areaWords(p.address))).toBe(true);
  });
});
