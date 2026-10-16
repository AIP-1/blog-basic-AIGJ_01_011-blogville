import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blogs } from "@/db/schema";
import { isKoreaCoord, parsePlaceHits, PLACE_QUERY_MAX, PLACE_RESULTS_MAX, roundTo, type PlaceHit, type WeatherPlace } from "@/lib/weather-place";
import { getDong } from "./weather";

// ☀️ 날씨 위젯의 블로그 동네 (주인만). 카카오 주소·키워드 검색으로 찾은 자리를 행정동 이름("광주 서구 상무1동")으로 바꾼다.
// 카카오 열쇠(KAKAO_REST_API_KEY)가 없으면 꺼지고, 주인은 예전처럼 도시 목록에서 고른다.
// 저장할 때는 브라우저가 보낸 좌표로 서버가 이름을 다시 받아 쓰고, 좌표는 0.01도(약 1km)로 줄여 둔다 (검색어가 집 주소여도 그 자리를 남기지 않는다).
// 시험은 KAKAO_API_BASE로 가짜 서버를 가리킨다.
const KAKAO_BASE = () => process.env.KAKAO_API_BASE ?? "https://dapi.kakao.com";
const TIMEOUT_MS = 4_000;
const SEARCH_TTL_MS = 6 * 3_600_000;
const searchCache = new Map<string, { at: number; value: Promise<WeatherPlace[]> }>();

type Found = { places: WeatherPlace[]; complete: boolean };

export function weatherPlaceEnabled(): boolean {
  return !!process.env.KAKAO_REST_API_KEY;
}

async function kakaoHits(path: string, query: string): Promise<PlaceHit[]> {
  const res = await fetch(`${KAKAO_BASE()}${path}?${new URLSearchParams({ query, size: String(PLACE_RESULTS_MAX) })}`, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`kakao ${path} ${res.status}`);
  return parsePlaceHits(await res.json());
}

async function search(query: string): Promise<Found> {
  // 주소(동·읍·면 이름)를 먼저, 그다음 장소(역·건물·"상무1동 행정복지센터"). 한쪽이 실패해도 다른 쪽은 쓴다
  const [address, keyword] = await Promise.allSettled([
    kakaoHits("/v2/local/search/address.json", query),
    kakaoHits("/v2/local/search/keyword.json", query),
  ]);
  if (address.status === "rejected" && keyword.status === "rejected") throw address.reason;
  const hits = [...(address.status === "fulfilled" ? address.value : []), ...(keyword.status === "fulfilled" ? keyword.value : [])];
  const names = await Promise.all(hits.map((h) => getDong(h.lat, h.lon)));
  // 동 이름을 하나도 못 받았으면(한도 초과·시간 초과) "없어요"가 아니라 실패로 알린다
  if (hits.length > 0 && names.every((n) => n === null)) throw new Error("kakao region lookup failed");
  const seen = new Set<string>();
  const out: WeatherPlace[] = [];
  hits.forEach((h, i) => {
    const d = names[i];
    if (!d || seen.has(d.full) || out.length >= PLACE_RESULTS_MAX) return;
    seen.add(d.full);
    out.push({ name: d.full, lat: h.lat, lon: h.lon });
  });
  // 한쪽 검색이나 동 이름 몇 개를 못 받았으면 이번 결과는 기억하지 않는다 (다음에 다시 묻는다)
  return { places: out, complete: address.status === "fulfilled" && keyword.status === "fulfilled" && names.every((n) => n !== null) };
}

/** 동네 찾기 (같은 검색어는 6시간 기억, 실패나 일부만 받은 결과는 기억하지 않는다). 열쇠가 없거나 검색어가 비면 빈 목록 */
export function searchWeatherPlaces(query: string): Promise<WeatherPlace[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, PLACE_QUERY_MAX);
  if (!q || !weatherPlaceEnabled()) return Promise.resolve([]);
  const hit = searchCache.get(q);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.value;
  const found = search(q);
  const value = found.then((f) => f.places);
  searchCache.set(q, { at: Date.now(), value });
  found.then(
    (f) => !f.complete && searchCache.get(q)?.value === value && searchCache.delete(q),
    () => searchCache.get(q)?.value === value && searchCache.delete(q),
  );
  if (searchCache.size > 500) for (const [k, v] of searchCache) if (Date.now() - v.at >= SEARCH_TTL_MS) searchCache.delete(k);
  return value;
}

/**
 * 내 블로그 날씨 동네 정하기: 고른 좌표의 행정동 이름을 서버가 다시 받아 저장한다. 못 받으면 null.
 * 도시(weather_city)는 비운다 — 위젯은 도시가 비어 있을 때만 동네를 쓰므로, 예전 판이 도시를 저장하면 그쪽이 이긴다.
 */
export async function setBlogWeatherPlace(ownerId: string, lat: number, lon: number): Promise<WeatherPlace | null> {
  if (!weatherPlaceEnabled() || !isKoreaCoord(lat, lon)) return null;
  const dong = await getDong(roundTo(lat, 3), roundTo(lon, 3));
  if (!dong) return null;
  const place = { name: dong.full.slice(0, 60), lat: roundTo(lat, 2), lon: roundTo(lon, 2) };
  await db.update(blogs).set({ weatherCity: null, weatherPlace: place.name, weatherLat: place.lat, weatherLon: place.lon }).where(eq(blogs.ownerId, ownerId));
  return place;
}
