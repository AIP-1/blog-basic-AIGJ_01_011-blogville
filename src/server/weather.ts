import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogs } from "@/db/schema";
import { isCityKey, parseForecast, type Weather } from "@/lib/weather";

// ☀️ 날씨 위젯 자료: Open-Meteo(열쇠 없음)를 서버가 받아 자리마다 30분 기억한다.
// 브라우저는 Open-Meteo를 직접 부르지 않는다 (사이트 CSP는 그대로). 시험은 WEATHER_BASE·AIR_BASE로 가짜 서버를 가리킨다.
const WEATHER_BASE = () => process.env.WEATHER_BASE ?? "https://api.open-meteo.com";
const AIR_BASE = () => process.env.AIR_BASE ?? "https://air-quality-api.open-meteo.com";
const TTL_MS = 30 * 60_000;
// 못 받았을 때는 잠깐만 기억해 1분 뒤 다시 묻는다
const FAIL_TTL_MS = 60_000;
const TIMEOUT_MS = 4_000;
// 미세먼지 서버는 예보보다 느려서 더 기다린다. 미세먼지만 못 받았으면 5분 뒤 다시 묻는다
const AIR_TIMEOUT_MS = 8_000;
const NO_AIR_TTL_MS = 5 * 60_000;

const cache = new Map<string, { at: number; ttl: number; value: Promise<Weather | null> }>();

async function getJson(url: string, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  return res.json();
}

async function load(lat: number, lon: number): Promise<Weather | null> {
  const at = `latitude=${lat}&longitude=${lon}&timezone=auto`;
  const forecast = getJson(
    `${WEATHER_BASE()}/v1/forecast?${at}&forecast_days=7` +
      "&current=temperature_2m,weather_code,is_day" +
      "&hourly=temperature_2m,weather_code,is_day" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  // 미세먼지는 없어도 날씨는 보여 준다
  const air = getJson(`${AIR_BASE()}/v1/air-quality?${at}&current=pm10,pm2_5`, AIR_TIMEOUT_MS).catch((e: unknown) => {
    console.warn("[weather] 미세먼지 못 받음", e instanceof Error ? e.message : e);
    return null;
  });
  return parseForecast(await forecast, await air);
}

/** 그 자리의 날씨 (30분 기억). 못 받으면 null */
export function getWeather(lat: number, lon: number): Promise<Weather | null> {
  const key = `${lat},${lon}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  const entry = { at: Date.now(), ttl: TTL_MS, value: Promise.resolve<Weather | null>(null) };
  entry.value = load(lat, lon)
    .catch((e: unknown) => {
      console.warn("[weather] 예보 못 받음", e instanceof Error ? e.message : e);
      return null;
    })
    .then((w) => {
      entry.ttl = w === null ? FAIL_TTL_MS : w.pm10 === null && w.pm25 === null ? NO_AIR_TTL_MS : TTL_MS;
      return w;
    });
  cache.set(key, entry);
  if (cache.size > 2_000) for (const [k, v] of cache) if (Date.now() - v.at >= TTL_MS) cache.delete(k);
  return entry.value;
}

/** 내 블로그의 날씨 도시 바꾸기. 모르는 도시면 false */
export async function setBlogWeatherCity(ownerId: string, key: string): Promise<boolean> {
  if (!isCityKey(key)) return false;
  await db.update(blogs).set({ weatherCity: key }).where(eq(blogs.ownerId, ownerId));
  return true;
}
