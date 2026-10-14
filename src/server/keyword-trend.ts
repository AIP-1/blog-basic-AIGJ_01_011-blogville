import "server-only";
import { todayKST } from "@/lib/kst";
import { parseTrend, trendRequest, type TrendPeriod, type TrendResult } from "@/lib/keyword-trend";

// 🔎 키워드 도우미 자료: NAVER API HUB 데이터랩 검색어 트렌드(한 달 5만 번)를 서버가 부른다.
// 열쇠는 뉴스 위젯과 같은 앱(NAVER_SEARCH_CLIENT_ID·_SECRET)에 검색어 트렌드를 추가해 쓴다.
// 다른 앱으로 받았다면 NAVER_TREND_CLIENT_ID·_SECRET이 먼저 쓰인다. 같은 단어 묶음·기간은 그날 6시간 기억한다.
// 시험은 TREND_API_BASE로 가짜 서버를 가리킨다.
const BASE = () => process.env.TREND_API_BASE ?? "https://naverapihub.apigw.ntruss.com";
const TTL_MS = 6 * 3_600_000;
const FAIL_TTL_MS = 60_000;
const TIMEOUT_MS = 5_000;

function keys(): { id: string; secret: string } | null {
  const id = process.env.NAVER_TREND_CLIENT_ID || process.env.NAVER_SEARCH_CLIENT_ID;
  const secret = process.env.NAVER_TREND_CLIENT_SECRET || process.env.NAVER_SEARCH_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}

export function trendEnabled(): boolean {
  return keys() !== null;
}

const cache = new Map<string, { at: number; ttl: number; value: Promise<TrendResult> }>();

async function load(keywords: string[], period: TrendPeriod, today: string): Promise<TrendResult> {
  const k = keys()!;
  const res = await fetch(`${BASE()}/search-trend/v1/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-NCP-APIGW-API-KEY-ID": k.id,
      "X-NCP-APIGW-API-KEY": k.secret,
    },
    body: JSON.stringify(trendRequest(keywords, period, today)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  // 앱에 검색어 트렌드를 추가하지 않았으면 401·403
  if (res.status === 401 || res.status === 403) return { status: "forbidden" };
  if (!res.ok) throw new Error(`search-trend ${res.status}`);
  const series = parseTrend(await res.json(), keywords);
  if (!series) throw new Error("search-trend shape");
  return { status: "ok", period, series };
}

/** 단어들의 검색 관심도. 열쇠가 없으면 off */
export function getKeywordTrend(keywords: string[], period: TrendPeriod): Promise<TrendResult> {
  if (!trendEnabled()) return Promise.resolve({ status: "off" });
  const today = todayKST();
  const id = `${today}|${period}|${keywords.join("\u0000")}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  const entry = { at: Date.now(), ttl: TTL_MS, value: Promise.resolve<TrendResult>({ status: "error" }) };
  entry.value = load(keywords, period, today).catch((e): TrendResult => {
    console.error("검색어 트렌드를 못 받았어요", e instanceof Error ? e.message : e);
    return { status: "error" };
  });
  void entry.value.then((r) => {
    if (r.status !== "ok") entry.ttl = FAIL_TTL_MS;
  });
  cache.set(id, entry);
  if (cache.size > 2_000) for (const [key, v] of cache) if (Date.now() - v.at >= v.ttl) cache.delete(key);
  return entry.value;
}
