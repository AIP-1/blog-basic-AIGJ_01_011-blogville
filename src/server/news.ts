import "server-only";
import { NEWS_TABS, pickIssues, type NewsResult, type NewsTab } from "@/lib/news";

// 📰 뉴스 위젯: 네이버 검색 API(뉴스, 최신순 100건)를 탭마다 10분 동안 기억하고 "많이 다룬 이슈" TOP 5를 고른다.
// 열쇠(NAVER_SEARCH_CLIENT_ID·_SECRET)가 없으면 꺼진다. 시험은 NEWS_API_BASE로 가짜 서버를 가리킨다.
const BASE = () => process.env.NEWS_API_BASE ?? "https://openapi.naver.com";
const TTL_MS = 10 * 60_000;
const FAIL_TTL_MS = 60_000;
const cache = new Map<NewsTab, { at: number; ttl: number; value: Promise<NewsResult | null> }>();

export function newsEnabled(): boolean {
  return !!(process.env.NAVER_SEARCH_CLIENT_ID && process.env.NAVER_SEARCH_CLIENT_SECRET);
}

/** 탭의 이슈 TOP 5. 열쇠가 없거나 받지 못하면 null */
export function getNews(tab: NewsTab): Promise<NewsResult | null> {
  if (!newsEnabled()) return Promise.resolve(null);
  const hit = cache.get(tab);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value;
  const query = NEWS_TABS.find((t) => t.key === tab)!.query;
  const entry = { at: Date.now(), ttl: TTL_MS, value: Promise.resolve<NewsResult | null>(null) };
  entry.value = fetch(`${BASE()}/v1/search/news.json?query=${encodeURIComponent(query)}&display=100&sort=date`, {
    headers: {
      "X-Naver-Client-Id": process.env.NAVER_SEARCH_CLIENT_ID!,
      "X-Naver-Client-Secret": process.env.NAVER_SEARCH_CLIENT_SECRET!,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(4_000),
    cache: "no-store",
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`naver news ${res.status}`))))
    .then((json): NewsResult | null => {
      const items = pickIssues((json as { items?: unknown } | null)?.items);
      return items.length ? { tab, items, at: new Date().toISOString() } : null;
    })
    .catch((e) => {
      console.error("뉴스를 못 받았어요", e instanceof Error ? e.message : e);
      return null;
    });
  // 실패는 1분만 기억한다
  void entry.value.then((v) => {
    if (!v) entry.ttl = FAIL_TTL_MS;
  });
  cache.set(tab, entry);
  return entry.value;
}
