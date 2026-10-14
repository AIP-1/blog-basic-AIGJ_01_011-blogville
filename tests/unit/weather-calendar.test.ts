import { describe, expect, it } from "vitest";
import { cityOf, dustGrade, formatTemp, isCityKey, parseForecast, roundCoord, weatherLook, weekdayOf } from "@/lib/weather";
import { dayTone, HOLIDAYS, monthGrid, parseMonth, shiftMonth } from "@/lib/calendar";

// Open-Meteo forecast 응답 모양 (timezone=auto, 2시간 간격 칸을 고르는지 본다)
const hours = Array.from({ length: 48 }, (_, i) => `2026-10-${String(14 + Math.floor(i / 24))}T${String(i % 24).padStart(2, "0")}:00`);
const FORECAST = {
  timezone: "Asia/Seoul",
  current: { time: "2026-10-14T11:15", interval: 900, temperature_2m: 15.9, weather_code: 0, is_day: 1 },
  hourly: {
    time: hours,
    temperature_2m: hours.map((_, i) => 10 + (i % 24) / 2),
    weather_code: hours.map(() => 1),
    is_day: hours.map((_, i) => (i % 24 >= 7 && i % 24 < 18 ? 1 : 0)),
  },
  daily: {
    time: ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"],
    weather_code: [0, 2, 3, 61, 80, 71, 95],
    temperature_2m_max: [20, 21, 19, 18, 17, 16, 15],
    temperature_2m_min: [9, 10, 11, 8, 7, 6, 5],
    precipitation_probability_max: [0, 10, 20, 80, 60, null, 90],
  },
};

describe("날씨 위젯 자료", () => {
  it("지금·오늘 최저최고·2시간 간격 5칸·7일을 읽는다", () => {
    const w = parseForecast(FORECAST, { current: { pm10: 45, pm2_5: 12 } })!;
    expect(w.temp).toBe(15.9);
    expect([w.min, w.max]).toEqual([9, 20]);
    expect(w.hours.map((h) => h.time.slice(11, 13))).toEqual(["11", "13", "15", "17", "19"]);
    expect(w.hours[4].isDay).toBe(false);
    expect(w.days).toHaveLength(7);
    expect(w.days[5].rain).toBeNull();
    expect([dustGrade("pm10", w.pm10), dustGrade("pm25", w.pm25)]).toEqual(["보통", "좋음"]);
  });

  it("미세먼지가 없거나 응답 모양이 다르면 견딘다", () => {
    expect(parseForecast(FORECAST)!.pm10).toBeNull();
    expect(parseForecast(null)).toBeNull();
    expect(parseForecast({ current: { temperature_2m: "15" } })).toBeNull();
    expect(parseForecast({ current: { time: "2026-10-14T11:00", temperature_2m: 3 } })).toMatchObject({ hours: [], days: [], min: null });
  });

  it("코드·등급·글자", () => {
    expect(weatherLook(0)).toEqual({ label: "맑음", icon: "☀️" });
    expect(weatherLook(0, false).icon).toBe("🌙");
    expect(weatherLook(63).label).toBe("비");
    expect(weatherLook(81).label).toBe("소나기");
    expect(weatherLook(null).label).toBe("알 수 없음");
    expect(dustGrade("pm10", 151)).toBe("매우 나쁨");
    expect(dustGrade("pm25", 36)).toBe("나쁨");
    expect(formatTemp(15.94)).toBe("15.9°");
    expect(formatTemp(-0.04)).toBe("0°");
    expect(formatTemp(20)).toBe("20°");
    expect(weekdayOf("2026-10-14")).toBe("수");
  });

  it("도시·위치", () => {
    expect(cityOf(null).name).toBe("서울");
    expect(cityOf("busan").name).toBe("부산");
    expect(cityOf("<x>").key).toBe("seoul");
    expect(isCityKey("jeju")).toBe(true);
    expect(isCityKey("tokyo")).toBe(false);
    expect(roundCoord(37.56789, 126.97812)).toEqual({ lat: 37.6, lon: 127 });
    expect(roundCoord(91, 0)).toBeNull();
    expect(roundCoord(NaN, 0)).toBeNull();
  });
});

describe("캘린더 위젯", () => {
  it("2026년 10월: 일요일 시작, 앞뒤 달로 채운 5줄", () => {
    const grid = monthGrid("2026-10");
    expect(grid).toHaveLength(35);
    expect(grid[0]).toEqual({ date: "2026-09-27", inMonth: false });
    expect(grid[4]).toEqual({ date: "2026-10-01", inMonth: true });
    expect(grid[34]).toEqual({ date: "2026-10-31", inMonth: true });
    expect(monthGrid("2026-02")).toHaveLength(28);
  });

  it("일요일·공휴일 빨강, 토요일 파랑", () => {
    expect(dayTone("2026-10-03")).toBe("holiday");
    expect(dayTone("2026-10-04")).toBe("holiday");
    expect(dayTone("2026-10-05")).toBe("holiday");
    expect(dayTone("2026-10-09")).toBe("holiday");
    expect(dayTone("2026-10-10")).toBe("saturday");
    expect(dayTone("2026-10-14")).toBeNull();
    expect(HOLIDAYS["2026-07-17"]).toBe("제헌절");
    expect(Object.keys(HOLIDAYS).every((d) => /^202[67]-\d\d-\d\d$/.test(d))).toBe(true);
  });

  it("달 읽기·넘기기", () => {
    expect(parseMonth("2026-10")).toBe("2026-10");
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("1999-01")).toBeNull();
    expect(parseMonth(null)).toBeNull();
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
