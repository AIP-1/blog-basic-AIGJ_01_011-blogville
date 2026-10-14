// ☀️ 이번 주 날씨 위젯 (v1.7.0 위젯 보드). 자료는 열쇠가 필요 없는 Open-Meteo를 서버가 받아 30분 기억한다 (src/server/weather.ts).
// 위치는 보는 사람이 허락하면 그 자리, 아니면 블로그 주인이 고른 도시(기본 서울).

export type WeatherCity = { key: string; name: string; lat: number; lon: number };

/** 블로그 주인이 고를 수 있는 도시 (blogs.weather_city에 key를 저장) */
export const WEATHER_CITIES: readonly WeatherCity[] = [
  { key: "seoul", name: "서울", lat: 37.5665, lon: 126.978 },
  { key: "incheon", name: "인천", lat: 37.4563, lon: 126.7052 },
  { key: "suwon", name: "수원", lat: 37.2636, lon: 127.0286 },
  { key: "chuncheon", name: "춘천", lat: 37.8813, lon: 127.7298 },
  { key: "gangneung", name: "강릉", lat: 37.7519, lon: 128.8761 },
  { key: "cheongju", name: "청주", lat: 36.6424, lon: 127.489 },
  { key: "sejong", name: "세종", lat: 36.48, lon: 127.289 },
  { key: "daejeon", name: "대전", lat: 36.3504, lon: 127.3845 },
  { key: "jeonju", name: "전주", lat: 35.8242, lon: 127.148 },
  { key: "gwangju", name: "광주", lat: 35.1595, lon: 126.8526 },
  { key: "daegu", name: "대구", lat: 35.8714, lon: 128.6014 },
  { key: "pohang", name: "포항", lat: 36.019, lon: 129.3435 },
  { key: "ulsan", name: "울산", lat: 35.5384, lon: 129.3114 },
  { key: "changwon", name: "창원", lat: 35.2281, lon: 128.6811 },
  { key: "busan", name: "부산", lat: 35.1796, lon: 129.0756 },
  { key: "jeju", name: "제주", lat: 33.4996, lon: 126.5312 },
];
export const DEFAULT_CITY = "seoul";

/** 저장된 key의 도시. 모르는 값·NULL이면 서울 */
export function cityOf(key: string | null | undefined): WeatherCity {
  return WEATHER_CITIES.find((c) => c.key === key) ?? WEATHER_CITIES[0];
}

export function isCityKey(key: unknown): key is string {
  return typeof key === "string" && WEATHER_CITIES.some((c) => c.key === key);
}

/** 보는 사람 위치는 0.1도(약 10km)로 줄여 쓴다: 서버 기억 칸을 나눠 쓰고, 정확한 자리를 남기지 않는다 */
export function roundCoord(lat: number, lon: number): { lat: number; lon: number } | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10 };
}

/** WMO 날씨 코드 → 글자·그림 (Open-Meteo weather_code) */
export function weatherLook(code: number | null, isDay = true): { label: string; icon: string } {
  if (code === null) return { label: "알 수 없음", icon: "❔" };
  if (code === 0) return { label: "맑음", icon: isDay ? "☀️" : "🌙" };
  if (code === 1) return { label: "대체로 맑음", icon: isDay ? "🌤️" : "🌙" };
  if (code === 2) return { label: "구름 조금", icon: isDay ? "⛅" : "☁️" };
  if (code === 3) return { label: "흐림", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "안개", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "이슬비", icon: "🌦️" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 80 ? "소나기" : "비", icon: "🌧️" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "눈", icon: "🌨️" };
  if (code >= 95) return { label: "뇌우", icon: "⛈️" };
  return { label: "알 수 없음", icon: "❔" };
}

/** 미세먼지 등급 (환경부 기준, ㎍/㎥). pm10: 30·80·150, pm2.5: 15·35·75 */
export type DustGrade = "좋음" | "보통" | "나쁨" | "매우 나쁨";
export function dustGrade(kind: "pm10" | "pm25", value: number | null): DustGrade | null {
  if (value === null || !Number.isFinite(value)) return null;
  const [a, b, c] = kind === "pm10" ? [30, 80, 150] : [15, 35, 75];
  return value <= a ? "좋음" : value <= b ? "보통" : value <= c ? "나쁨" : "매우 나쁨";
}

export type WeatherHour = { time: string; temp: number; code: number | null; isDay: boolean };
export type WeatherDay = { date: string; code: number | null; max: number; min: number; rain: number | null };
export type Weather = {
  /** 그 자리의 현지 시각 `2026-10-14T11:00` */
  time: string;
  temp: number;
  code: number | null;
  isDay: boolean;
  min: number | null;
  max: number | null;
  pm10: number | null;
  pm25: number | null;
  /** 지금부터 2시간 간격 5칸 (그림의 시간대별 기온) */
  hours: WeatherHour[];
  /** 오늘부터 7일 */
  days: WeatherDay[];
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Open-Meteo forecast 응답 → 위젯 자료. 모양이 다르면 null */
export function parseForecast(json: unknown, air?: unknown): Weather | null {
  const j = json as { current?: Record<string, unknown>; hourly?: Record<string, unknown>; daily?: Record<string, unknown> } | null;
  const cur = j?.current;
  const temp = num(cur?.temperature_2m);
  const time = typeof cur?.time === "string" ? cur.time : null;
  if (temp === null || time === null) return null;

  const hTime = arr(j?.hourly?.time);
  const hTemp = arr(j?.hourly?.temperature_2m);
  const hCode = arr(j?.hourly?.weather_code);
  const hDay = arr(j?.hourly?.is_day);
  // 지금 시각이 든 칸부터 (현지 시각 글자끼리 비교: 같은 모양 `YYYY-MM-DDTHH:MM`)
  const nowHour = time.slice(0, 13);
  let start = hTime.findIndex((t) => typeof t === "string" && t.slice(0, 13) >= nowHour);
  if (start < 0) start = 0;
  const hours: WeatherHour[] = [];
  for (let i = start; i < hTime.length && hours.length < 5; i += 2) {
    const t = hTime[i];
    const v = num(hTemp[i]);
    if (typeof t !== "string" || v === null) continue;
    hours.push({ time: t, temp: v, code: num(hCode[i]), isDay: num(hDay[i]) !== 0 });
  }

  const dTime = arr(j?.daily?.time);
  const dCode = arr(j?.daily?.weather_code);
  const dMax = arr(j?.daily?.temperature_2m_max);
  const dMin = arr(j?.daily?.temperature_2m_min);
  const dRain = arr(j?.daily?.precipitation_probability_max);
  const days: WeatherDay[] = [];
  for (let i = 0; i < dTime.length && days.length < 7; i++) {
    const d = dTime[i];
    const max = num(dMax[i]);
    const min = num(dMin[i]);
    if (typeof d !== "string" || max === null || min === null) continue;
    days.push({ date: d, code: num(dCode[i]), max, min, rain: num(dRain[i]) });
  }

  const a = (air as { current?: Record<string, unknown> } | null | undefined)?.current;
  return {
    time,
    temp,
    code: num(cur?.weather_code),
    isDay: num(cur?.is_day) !== 0,
    min: days[0]?.min ?? null,
    max: days[0]?.max ?? null,
    pm10: num(a?.pm10),
    pm25: num(a?.pm2_5),
    hours,
    days,
  };
}

/** `15.9°` (소수 한 자리, .0은 뺀다) */
export function formatTemp(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${Number.isInteger(r) ? r.toFixed(0) : r.toFixed(1)}°`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
/** `YYYY-MM-DD` → `수` */
export function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
