import { describe, expect, it } from "vitest";
import { checkCoords, parseOpenMeteo, parsePlaceName, weatherIcon } from "@/lib/weather";

describe("날씨", () => {
  it("Open-Meteo 응답 → 7일 (반올림), 지금 기온", () => {
    const w = parseOpenMeteo(
      {
        current: { temperature_2m: 17.6, weather_code: 2 },
        daily: {
          time: ["2026-10-14", "2026-10-15"],
          weather_code: [2, 61],
          temperature_2m_max: [21.4, 18.5],
          temperature_2m_min: [11.2, 12.0],
          precipitation_probability_max: [10, null],
        },
      },
      "서울",
    );
    expect(w).toEqual({
      place: "서울",
      now: { temp: 18, code: 2 },
      days: [
        { date: "2026-10-14", code: 2, max: 21, min: 11, rain: 10 },
        { date: "2026-10-15", code: 61, max: 19, min: 12, rain: null },
      ],
    });
  });
  it("모양이 다르면 null", () => {
    expect(parseOpenMeteo({ error: true }, "x")).toBeNull();
    expect(parseOpenMeteo({ daily: { time: [] } }, "x")).toBeNull();
  });
  it("날씨 코드 → 그림·이름", () => {
    expect(weatherIcon(0)).toEqual(["☀️", "맑음"]);
    expect(weatherIcon(63)).toEqual(["🌧️", "비"]);
    expect(weatherIcon(1234)[1]).toBe("알 수 없음");
  });
  it("좌표는 범위 안의 수만, 소수 둘째 자리로", () => {
    expect(checkCoords("37.56651", "126.97801")).toEqual({ lat: 37.57, lon: 126.98 });
    expect(checkCoords("91", "0")).toBeNull();
    expect(checkCoords("x", "1")).toBeNull();
  });
  it("동네 이름: 구 → 시 순서", () => {
    expect(parsePlaceName({ address: { city: "서울특별시", borough: "중구" } })).toBe("중구");
    expect(parsePlaceName({ address: { city: "춘천시" } })).toBe("춘천시");
    expect(parsePlaceName({})).toBeNull();
  });
});
