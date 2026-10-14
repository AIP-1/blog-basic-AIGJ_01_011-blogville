import "server-only";
import { parseOpenMeteo, parsePlaceName, type Weather } from "@/lib/weather";

// 🌤️ 날씨 위젯: 서버가 Open-Meteo에서 받아 30분 동안 기억한다 (좌표는 소수 둘째 자리 ≈ 1km로 묶는다).
// 동네 이름은 OpenStreetMap Nominatim에서 하루 동안 기억한다 (사용 정책: 초당 1번 이하, 앱 이름을 밝힌다).
// 시험은 WEATHER_BASE·GEOCODE_BASE로 가짜 서버를 가리킨다.
const WEATHER_BASE = () => process.env.WEATHER_BASE ?? "https://api.open-meteo.com";
const GEOCODE_BASE = () => process.env.GEOCODE_BASE ?? "https://nominatim.openstreetmap.org";
const WEATHER_TTL_MS = 30 * 60_000;
const PLACE_TTL_MS = 24 * 60 * 60_000;
const TIMEOUT_MS = 4_000;
const UA = "Blogville weather widget (https://unqiuepcg.java21.net)";

const weatherCache = new Map<string, { at: number; value: Promise<Weather | null> }>();
const placeCache = new Map<string, { at: number; value: Promise<string | null> }>();
let lastGeocode = 0;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`weather ${res.status}`);
  return res.json();
}

function trim<T>(cache: Map<string, { at: number; value: T }>, ttl: number, max: number) {
  if (cache.size > max) for (const [k, v] of cache) if (Date.now() - v.at >= ttl) cache.delete(k);
}

/** 좌표의 동네 이름 (못 받으면 null). Nominatim은 초당 1번까지라 너무 잦으면 묻지 않는다 */
export function placeName(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = placeCache.get(key);
  if (hit && Date.now() - hit.at < PLACE_TTL_MS) return hit.value;
  if (Date.now() - lastGeocode < 1_100) return Promise.resolve(null);
  lastGeocode = Date.now();
  const value = getJson(`${GEOCODE_BASE()}/reverse?format=jsonv2&zoom=12&accept-language=ko&lat=${lat}&lon=${lon}`)
    .then(parsePlaceName)
    .catch(() => null);
  placeCache.set(key, { at: Date.now(), value });
  trim(placeCache, PLACE_TTL_MS, 5_000);
  return value;
}

/** 오늘부터 7일 날씨. place는 화면에 보일 이름. 못 받으면 null */
export function getWeather(lat: number, lon: number, place: string): Promise<Weather | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = weatherCache.get(key);
  if (hit && Date.now() - hit.at < WEATHER_TTL_MS) return hit.value.then((w) => (w ? { ...w, place } : null));
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "Asia/Seoul",
    forecast_days: "7",
  });
  const value = getJson(`${WEATHER_BASE()}/v1/forecast?${params}`)
    .then((json) => parseOpenMeteo(json, place))
    .catch(() => null);
  weatherCache.set(key, { at: Date.now(), value });
  // 실패는 1분만 기억한다
  value.then((w) => {
    if (!w) setTimeout(() => weatherCache.get(key)?.value === value && weatherCache.delete(key), 60_000);
  });
  trim(weatherCache, WEATHER_TTL_MS, 2_000);
  return value;
}
