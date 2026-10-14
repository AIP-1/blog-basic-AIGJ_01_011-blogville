// 🌤️ 날씨 위젯: Open-Meteo(무료·키 없음) 응답 읽기와 날씨 코드(WMO) → 그림·이름. 브라우저와 서버가 같이 쓴다.

export type WeatherDay = { date: string; code: number; max: number; min: number; rain: number | null };
export type Weather = { place: string; now: { temp: number; code: number } | null; days: WeatherDay[] };

/** 위도·경도가 말이 되는지 (소수 둘째 자리까지 쓴다) */
export function checkCoords(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const a = Number(lat);
  const b = Number(lon);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return null;
  return { lat: Math.round(a * 100) / 100, lon: Math.round(b * 100) / 100 };
}

const CODES: [number[], string, string][] = [
  [[0], "☀️", "맑음"],
  [[1], "🌤️", "대체로 맑음"],
  [[2], "⛅", "구름 조금"],
  [[3], "☁️", "흐림"],
  [[45, 48], "🌫️", "안개"],
  [[51, 53, 55, 56, 57], "🌦️", "이슬비"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "🌧️", "비"],
  [[71, 73, 75, 77, 85, 86], "🌨️", "눈"],
  [[95, 96, 99], "⛈️", "뇌우"],
];

/** 날씨 코드 → [그림, 이름] */
export function weatherIcon(code: number): [string, string] {
  const hit = CODES.find(([codes]) => codes.includes(code));
  return hit ? [hit[1], hit[2]] : ["🌡️", "알 수 없음"];
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const nums = (v: unknown): (number | null)[] => (Array.isArray(v) ? v.map((x) => (typeof x === "number" && Number.isFinite(x) ? x : null)) : []);

/** Open-Meteo forecast 응답 → 오늘부터 7일. 모양이 다르면 null */
export function parseOpenMeteo(json: unknown, place: string): Weather | null {
  const r = rec(json);
  const daily = rec(r?.daily);
  if (!daily || !Array.isArray(daily.time)) return null;
  const codes = nums(daily.weather_code);
  const max = nums(daily.temperature_2m_max);
  const min = nums(daily.temperature_2m_min);
  const rain = nums(daily.precipitation_probability_max);
  const days: WeatherDay[] = [];
  daily.time.forEach((date, i) => {
    if (typeof date !== "string" || codes[i] == null || max[i] == null || min[i] == null) return;
    days.push({ date, code: codes[i]!, max: Math.round(max[i]!), min: Math.round(min[i]!), rain: rain[i] ?? null });
  });
  if (days.length === 0) return null;
  const current = rec(r?.current);
  const temp = typeof current?.temperature_2m === "number" ? current.temperature_2m : null;
  const code = typeof current?.weather_code === "number" ? current.weather_code : null;
  return { place, now: temp !== null && code !== null ? { temp: Math.round(temp), code } : null, days: days.slice(0, 7) };
}

/** `2026-10-14` → `14일 (수)` 또는 오늘이면 `오늘` */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "오늘";
  const [y, m, d] = date.split("-").map(Number);
  const w = "일월화수목금토"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${w}`;
}

/** Nominatim 역지오코딩 응답 → 동네 이름 (시·군·구 중 가장 알맞은 것). 없으면 null */
export function parsePlaceName(json: unknown): string | null {
  const a = rec(rec(json)?.address);
  if (!a) return null;
  for (const k of ["city_district", "borough", "suburb", "city", "county", "town", "village", "state"]) {
    const v = a[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
