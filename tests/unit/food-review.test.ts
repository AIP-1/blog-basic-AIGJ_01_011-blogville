import { describe, expect, it } from "vitest";
import { normalizePlace, parsePlacePrefill, placeCardHtml, safeHttpUrl, withPlaceTags } from "@/lib/food-review";
import { reviewWriteHref } from "@/lib/food";

describe("parsePlacePrefill", () => {
  it("reviewWriteHref가 만든 주소를 그대로 읽는다", () => {
    const href = reviewWriteHref({ name: "할매국밥", category: "한식 > 국밥", address: "부산 중구 1", mapUrl: "https://place.map.kakao.com/123" });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parsePlacePrefill(params)).toEqual({ name: "할매국밥", category: "한식 > 국밥", address: "부산 중구 1", url: "https://place.map.kakao.com/123" });
  });

  it("이름이 없거나 너무 길면 null", () => {
    expect(parsePlacePrefill({})).toBeNull();
    expect(parsePlacePrefill({ place_name: "  " })).toBeNull();
    expect(parsePlacePrefill({ place_name: "가".repeat(101) })).toBeNull();
  });

  it("http(s)가 아닌 지도 주소는 버린다", () => {
    expect(parsePlacePrefill({ place_name: "a", place_url: "javascript:alert(1)" })?.url).toBe("");
    expect(safeHttpUrl("data:text/html,x")).toBe("");
    expect(safeHttpUrl("https://map.naver.com/p/search/a")).toBe("https://map.naver.com/p/search/a");
  });
});

describe("placeCardHtml", () => {
  it("이름·카테고리·주소·지도 링크를 인용 상자로 만들고 글자를 이스케이프한다", () => {
    const html = placeCardHtml({ name: "<b>집</b>", category: "카페", address: "서울", url: "https://m.map.kakao.com/?q=a&b=\"c\"" });
    expect(html).toContain("<blockquote><p><strong>🍽 &lt;b&gt;집&lt;/b&gt;</strong> · 카페</p><p>📍 서울</p>");
    expect(html).toContain('href="https://m.map.kakao.com/?q=a&amp;b=');
    expect(html).not.toContain('"c"');
    expect(html).not.toContain("<b>");
  });

  it("없는 칸은 줄을 만들지 않는다", () => {
    expect(placeCardHtml({ name: "a", category: "", address: "", url: "" })).toBe("<blockquote><p><strong>🍽 a</strong></p></blockquote><p></p>");
  });
});

describe("withPlaceTags", () => {
  it("맛집과 식당 이름을 더하고 겹치면 한 번만", () => {
    expect(withPlaceTags("", "할매국밥")).toBe("맛집, 할매국밥");
    expect(withPlaceTags("부산, 맛집", "할매국밥")).toBe("부산, 맛집, 할매국밥");
  });
});

describe("normalizePlace", () => {
  it("모양이 틀리면 null, 좌표·주소는 걸러 담는다", () => {
    expect(normalizePlace(null)).toBeNull();
    expect(normalizePlace({ id: "1" })).toBeNull();
    expect(normalizePlace({ id: "1", name: "a", lat: 999, lng: 127.1, mapUrl: "javascript:x", distance: 5 })).toEqual({
      id: "1", name: "a", category: "", address: "", phone: "", mapUrl: "", lat: null, lng: 127.1, distance: null,
    });
  });
});
