// ☀️ 날씨 위젯의 블로그 동네: 주인이 동네 이름(또는 역·건물 이름)을 찾으면 카카오 검색 결과를 행정동으로 바꿔 보여 준다.
// 서버(src/server/weather-place.ts)와 위젯이 같이 쓰는 순수 함수만 둔다.

export type WeatherPlace = { name: string; lat: number; lon: number };
export type PlaceHit = { lat: number; lon: number; hint: string };

export const PLACE_QUERY_MAX = 30;
export const PLACE_RESULTS_MAX = 8;

/** 우리나라 안의 좌표인지 (제주 남쪽 끝 ~ 강원 북쪽, 서해 ~ 울릉·독도) */
export function isKoreaCoord(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;
}

/** 소수 n자리로 줄인다 */
export function roundTo(v: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(v * k) / k;
}

/** "광주 서구 상무1동" → "상무1동" (위젯 머리에 짧게) */
export function placeShort(name: string): string {
  return name.trim().split(/\s+/).pop() ?? name;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * 카카오 주소 검색·키워드 검색 응답 → 좌표 후보 (나라 밖·좌표 없는 것은 뺀다).
 * hint는 무엇으로 찾았는지 (주소 이름이나 장소 이름) — 같은 동이 여러 번 나오면 첫 번째만 쓴다.
 */
export function parsePlaceHits(json: unknown): PlaceHit[] {
  const docs = (json as { documents?: unknown } | null)?.documents;
  if (!Array.isArray(docs)) return [];
  const out: PlaceHit[] = [];
  for (const d of docs as Record<string, unknown>[]) {
    const lat = num(d?.y);
    const lon = num(d?.x);
    if (lat === null || lon === null || !isKoreaCoord(lat, lon)) continue;
    const hint = String(d.place_name ?? d.address_name ?? "").trim().slice(0, 60);
    out.push({ lat: roundTo(lat, 3), lon: roundTo(lon, 3), hint });
  }
  return out;
}
