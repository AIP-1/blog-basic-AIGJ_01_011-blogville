import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isKoreaCoord, parsePlaceHits, placeShort, roundTo } from "@/lib/weather-place";

// 저장은 DB 대신 받은 값만 본다
const saved: unknown[] = [];
vi.mock("@/db", () => ({
  db: {
    update: () => ({ set: (v: unknown) => ({ where: async () => void saved.push(v) }) }),
  },
}));

describe("날씨 동네 (순수 함수)", () => {
  it("동네 이름은 맨 끝 말만 짧게", () => {
    expect(placeShort("광주 서구 상무1동")).toBe("상무1동");
    expect(placeShort("경기 성남시 분당구 정자1동")).toBe("정자1동");
    expect(placeShort(" 세종 조치원읍 ")).toBe("조치원읍");
  });

  it("우리나라 좌표만, 소수 n자리로 줄이기", () => {
    expect(isKoreaCoord(35.1534, 126.8512)).toBe(true);
    expect(isKoreaCoord(37.5, 140)).toBe(false);
    expect(isKoreaCoord(Number.NaN, 127)).toBe(false);
    expect(roundTo(35.15349, 3)).toBe(35.153);
    expect(roundTo(126.8562, 2)).toBe(126.86);
  });

  it("카카오 주소·키워드 응답 → 좌표 후보 (좌표 없거나 나라 밖은 뺀다)", () => {
    const hits = parsePlaceHits({
      documents: [
        { address_name: "광주 서구 치평동", x: "126.84718", y: "35.15212" },
        { place_name: "상무1동행정복지센터", address_name: "광주 서구 치평동 1234", x: 126.8512, y: 35.1534 },
        { place_name: "좌표 없음" },
        { place_name: "도쿄", x: "139.69", y: "35.68" },
      ],
    });
    expect(hits).toEqual([
      { lat: 35.152, lon: 126.847, hint: "광주 서구 치평동" },
      { lat: 35.153, lon: 126.851, hint: "상무1동행정복지센터" },
    ]);
    expect(parsePlaceHits(null)).toEqual([]);
    expect(parsePlaceHits({ documents: "x" })).toEqual([]);
  });
});

describe("날씨 동네 찾기·저장 (가짜 카카오)", () => {
  const calls: string[] = [];
  // 좌표 → 행정동: 경도 126.84x는 상무1동, 126.85x는 상무2동, 그 밖은 화정1동
  function region(x: number) {
    const dong = x < 126.85 ? "상무1동" : x < 126.86 ? "상무2동" : "화정1동";
    return { documents: [{ region_type: "B", region_1depth_name: "광주광역시", region_2depth_name: "서구", region_3depth_name: "치평동" }, { region_type: "H", region_1depth_name: "광주광역시", region_2depth_name: "서구", region_3depth_name: dong }] };
  }

  beforeEach(() => {
    vi.resetModules();
    calls.length = 0;
    saved.length = 0;
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    vi.stubEnv("KAKAO_API_BASE", "http://kakao.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        calls.push(url.pathname);
        if (url.pathname.endsWith("/address.json")) {
          if (url.searchParams.get("query") === "고장") return new Response("{}", { status: 500 });
          return Response.json({ documents: [{ address_name: "광주 서구 치평동", x: "126.845", y: "35.152" }] });
        }
        if (url.pathname.endsWith("/keyword.json")) {
          return Response.json({
            documents: [
              { place_name: "상무1동행정복지센터", x: "126.846", y: "35.153" },
              { place_name: "상무역", x: "126.855", y: "35.154" },
              { place_name: "화정역", x: "126.866", y: "35.155" },
            ],
          });
        }
        if (url.pathname.endsWith("/coord2regioncode.json")) return Response.json(region(Number(url.searchParams.get("x"))));
        return new Response("{}", { status: 404 });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("주소와 장소를 행정동으로 바꾸고 같은 동은 한 번만", async () => {
    const { searchWeatherPlaces } = await import("@/server/weather-place");
    const places = await searchWeatherPlaces("  상무  ");
    expect(places).toEqual([
      { name: "광주 서구 상무1동", lat: 35.152, lon: 126.845 },
      { name: "광주 서구 상무2동", lat: 35.154, lon: 126.855 },
      { name: "광주 서구 화정1동", lat: 35.155, lon: 126.866 },
    ]);
    // 같은 검색어는 다시 묻지 않는다
    const n = calls.length;
    await searchWeatherPlaces("상무");
    expect(calls.length).toBe(n);
  });

  it("주소 검색이 실패해도 장소 검색으로 찾는다", async () => {
    const { searchWeatherPlaces } = await import("@/server/weather-place");
    const places = await searchWeatherPlaces("고장");
    expect(places.map((p) => p.name)).toEqual(["광주 서구 상무1동", "광주 서구 상무2동", "광주 서구 화정1동"]);
  });

  it("열쇠가 없으면 찾지 않는다", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    const { searchWeatherPlaces, weatherPlaceEnabled, setBlogWeatherPlace } = await import("@/server/weather-place");
    expect(weatherPlaceEnabled()).toBe(false);
    expect(await searchWeatherPlaces("상무")).toEqual([]);
    expect(await setBlogWeatherPlace("u1", 35.153, 126.846)).toBeNull();
    expect(calls).toEqual([]);
  });

  it("저장은 서버가 동 이름을 다시 받고 좌표는 0.01도로 줄인다", async () => {
    const { setBlogWeatherPlace } = await import("@/server/weather-place");
    const place = await setBlogWeatherPlace("u1", 35.1534, 126.8462);
    expect(place).toEqual({ name: "광주 서구 상무1동", lat: 35.15, lon: 126.85 });
    expect(saved).toEqual([{ weatherPlace: "광주 서구 상무1동", weatherLat: 35.15, weatherLon: 126.85 }]);
    // 나라 밖 좌표는 묻지도 않는다
    expect(await setBlogWeatherPlace("u1", 35.68, 139.69)).toBeNull();
    expect(saved).toHaveLength(1);
  });
});
