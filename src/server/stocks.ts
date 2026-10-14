import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogs, blogStocks } from "@/db/schema";
import { isUniqueViolation } from "./names";
import { parseNaverQuote, parseNaverSearchItem, STOCK_ERRORS, STOCK_MAX, type StockItem, type StockQuote } from "@/lib/stocks";

// 블로그 관심 종목 (📈 위젯). 시세는 네이버 증권이 화면에 쓰는 공개 주소에서 서버가 받아 잠깐 기억해 둔다.
// 공식 API가 아니라 응답 모양이 바뀌거나 막히면 price가 null인 줄로 보여 준다(위젯이 "시세를 못 받았어요").
// 시험은 STOCK_QUOTE_BASE·STOCK_SEARCH_BASE로 가짜 서버를 가리킨다.
const QUOTE_BASE = () => process.env.STOCK_QUOTE_BASE ?? "https://polling.finance.naver.com";
const SEARCH_BASE = () => process.env.STOCK_SEARCH_BASE ?? "https://ac.stock.naver.com";
// 실시간 스트림(1.5초마다)이 같은 종목을 여러 화면에 보내도 네이버에는 종목마다 1초에 한 번만 묻는다
const QUOTE_TTL_MS = 1_000;
const SEARCH_TTL_MS = 60_000;
const TIMEOUT_MS = 3_000;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; Blogville stock widget)",
  Referer: "https://m.stock.naver.com/",
  Accept: "application/json",
};

/** 블로그의 관심 종목 (넣은 순서) */
export async function listBlogStocks(blogId: number) {
  return db
    .select({ id: blogStocks.id, market: blogStocks.market, code: blogStocks.code, name: blogStocks.name })
    .from(blogStocks)
    .where(eq(blogStocks.blogId, blogId))
    .orderBy(asc(blogStocks.createdAt), asc(blogStocks.id)) as Promise<(StockItem & { id: number })[]>;
}

/** 관심 종목 넣기: 블로그 행을 잠그고 개수를 세어 10개를 넘지 않게 한다. 실패하면 문구 */
export async function addBlogStock(ownerId: string, item: StockItem): Promise<string | null> {
  try {
    return await db.transaction(async (tx) => {
      const [blog] = await tx.select({ id: blogs.id }).from(blogs).where(eq(blogs.ownerId, ownerId)).for("update");
      if (!blog) return STOCK_ERRORS.invalid;
      const [{ n }] = await tx.select({ n: count() }).from(blogStocks).where(eq(blogStocks.blogId, blog.id));
      if (n >= STOCK_MAX) return STOCK_ERRORS.full;
      await tx.insert(blogStocks).values({ blogId: blog.id, ...item });
      return null;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return STOCK_ERRORS.duplicate;
    throw e;
  }
}

/** 관심 종목 빼기: 내 블로그의 줄만 */
export async function removeBlogStock(ownerId: string, id: number): Promise<void> {
  const [blog] = await db.select({ id: blogs.id }).from(blogs).where(eq(blogs.ownerId, ownerId));
  if (!blog) return;
  await db.delete(blogStocks).where(and(eq(blogStocks.id, id), eq(blogStocks.blogId, blog.id)));
}

type Parsed = NonNullable<ReturnType<typeof parseNaverQuote>>;
const quoteCache = new Map<string, { at: number; value: Promise<Parsed | null> }>();
const searchCache = new Map<string, { at: number; value: Promise<StockItem[]> }>();

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  if (!res.ok) throw new Error(`naver ${res.status}`);
  return res.json();
}

function quoteUrl(item: StockItem) {
  const kind = item.market === "KR" ? "domestic" : "worldstock";
  return `${QUOTE_BASE()}/api/realtime/${kind}/stock/${encodeURIComponent(item.code)}`;
}

/** 한 종목 시세 (몇 초 동안은 같은 결과를 함께 쓴다). 못 받으면 null */
function fetchOne(item: StockItem): Promise<Parsed | null> {
  const key = `${item.market}:${item.code}`;
  const hit = quoteCache.get(key);
  if (hit && Date.now() - hit.at < QUOTE_TTL_MS) return hit.value;
  const value = getJson(quoteUrl(item))
    .then((json) => {
      const datas = (json as { datas?: unknown[] } | null)?.datas;
      if (!Array.isArray(datas)) return null;
      return datas.map(parseNaverQuote).find((q) => q && q.key.toUpperCase() === item.code.toUpperCase()) ?? parseNaverQuote(datas[0]);
    })
    .catch(() => null);
  quoteCache.set(key, { at: Date.now(), value });
  if (quoteCache.size > 2_000) for (const [k, v] of quoteCache) if (Date.now() - v.at >= QUOTE_TTL_MS) quoteCache.delete(k);
  return value;
}

/** 종목들의 시세 (넣은 순서 그대로). 받지 못한 종목은 price가 null */
export async function getQuotes(items: StockItem[]): Promise<StockQuote[]> {
  const rows = await Promise.all(items.map(fetchOne));
  return items.map((item, i) => {
    const q = rows[i];
    return {
      market: item.market,
      code: item.code,
      name: item.name,
      price: q?.price ?? null,
      change: q?.change ?? null,
      rate: q?.rate ?? null,
      currency: q?.currency ?? (item.market === "KR" ? "KRW" : "USD"),
      status: q?.status ?? null,
    };
  });
}

/** 종목 검색 (국내·미국 주식만, 최대 10개). 못 받으면 빈 목록 */
export function searchStocks(query: string): Promise<StockItem[]> {
  const q = query.trim().slice(0, 30);
  if (!q) return Promise.resolve([]);
  const hit = searchCache.get(q);
  if (hit && Date.now() - hit.at < SEARCH_TTL_MS) return hit.value;
  const value = getJson(`${SEARCH_BASE()}/ac?q=${encodeURIComponent(q)}&target=stock`)
    .then((json) => {
      const items = (json as { items?: unknown[] } | null)?.items;
      if (!Array.isArray(items)) return [];
      const seen = new Set<string>();
      return items
        .map(parseNaverSearchItem)
        .filter((x): x is StockItem => x !== null && !seen.has(`${x.market}:${x.code}`) && !!seen.add(`${x.market}:${x.code}`))
        .slice(0, 10);
    })
    .catch(() => [] as StockItem[]);
  searchCache.set(q, { at: Date.now(), value });
  if (searchCache.size > 500) for (const [k, v] of searchCache) if (Date.now() - v.at >= SEARCH_TTL_MS) searchCache.delete(k);
  return value;
}

/** 블로그 주소로 관심 종목 (위젯이 5초마다 부르는 길). 없는 블로그는 빈 목록 */
export async function listStocksBySlug(slug: string): Promise<StockItem[]> {
  return db
    .select({ market: blogStocks.market, code: blogStocks.code, name: blogStocks.name })
    .from(blogStocks)
    .innerJoin(blogs, eq(blogs.id, blogStocks.blogId))
    .where(eq(blogs.slug, slug))
    .orderBy(asc(blogStocks.createdAt), asc(blogStocks.id)) as Promise<StockItem[]>;
}
