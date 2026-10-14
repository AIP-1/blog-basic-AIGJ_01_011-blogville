// 시세·날씨 서비스가 대신 받아 주는 바깥 API 목록과 경로 풀이 (순수 함수라 tests/unit에서 시험한다).
// 정해진 바깥 주소로만 가고(아무 주소나 대신 받아 주는 길이 되지 않게), GET만 받는다.

/** 앞머리 → 바깥 주소와 기억 시간(ms). 앱의 STOCK_*_BASE·WEATHER_BASE·AIR_BASE 기본값과 같은 곳이다 */
export const UPSTREAMS = {
  "/naver/polling": { base: "https://polling.finance.naver.com", ttl: 1_000 },
  "/naver/api": { base: "https://api.stock.naver.com", ttl: 60_000 },
  "/naver/ac": { base: "https://ac.stock.naver.com", ttl: 60_000 },
  "/open-meteo/api": { base: "https://api.open-meteo.com", ttl: 30 * 60_000 },
  "/open-meteo/air": { base: "https://air-quality-api.open-meteo.com", ttl: 30 * 60_000 },
};

/**
 * 들어온 경로(+쿼리)를 바깥 주소로 바꾼다. 모르는 앞머리, `..`·`//`가 섞인 경로는 null.
 * @param {string} pathAndQuery 예: "/naver/polling/api/realtime/domestic/stock/005930"
 * @param {Record<string, {base: string, ttl: number}>} [upstreams] 시험에서 가짜 서버를 가리킬 때
 * @returns {{ url: string, ttl: number, prefix: string } | null}
 */
export function resolveUpstream(pathAndQuery, upstreams = UPSTREAMS) {
  if (typeof pathAndQuery !== "string" || !pathAndQuery.startsWith("/") || pathAndQuery.length > 2048) return null;
  const q = pathAndQuery.indexOf("?");
  const path = q === -1 ? pathAndQuery : pathAndQuery.slice(0, q);
  const query = q === -1 ? "" : pathAndQuery.slice(q);
  if (path.includes("..") || path.includes("//") || path.includes("\\")) return null;
  for (const [prefix, { base, ttl }] of Object.entries(upstreams)) {
    if (path === prefix || path.startsWith(prefix + "/")) {
      const rest = path.slice(prefix.length) || "/";
      return { url: base + rest + query, ttl, prefix };
    }
  }
  return null;
}
