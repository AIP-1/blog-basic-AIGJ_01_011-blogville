import "server-only";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { blogs, posts, profiles } from "@/db/schema";
import { likePattern } from "@/lib/blog-search";
import { countBuzz, interestKeywords, isRegionCandidate, isRising, rankRegion, summarizeInterest, type RankedPlace } from "@/lib/food-quality";
import { detectSponsor, pickOgImage, reviewFetchUrl } from "@/lib/food-sponsor";
import { placeKind, type FoodKind, type FoodKindFilter } from "@/lib/food-kind";
import { relevantReviews, REVIEW_PAGE_MAX, REVIEW_PAGE_SIZE } from "@/lib/food-relevance";
import { todayKST } from "@/lib/kst";
import {
  FOOD_RADIUS_M,
  FOOD_RECENT_CAP,
  areaOf,
  dedupePlaces,
  parseKakaoPlaces,
  parseNaverPlaces,
  parseReviews,
  rankByBuzz,
  type BuzzPlace,
  type FoodPlace,
  type FoodReview,
} from "@/lib/food";

// 🍽 맛집: 카카오 로컬(내 주변·식당 찾기, 하루 10만 번 무료)과 NAVER API HUB 검색(지역 인기·블로그 후기)을 서버가 부른다.
// 열쇠: KAKAO_REST_API_KEY(카카오맵 사용 설정을 켠 앱의 REST API 키), NAVER_SEARCH_CLIENT_ID·_SECRET(뉴스 위젯과 같은 앱에 지역·블로그 추가).
// 둘 중 하나만 있어도 되는 탭은 켜진다. 같은 질문은 6시간 기억하고, 실패는 1분만 기억한다.
// 시험은 KAKAO_API_BASE·FOOD_NAVER_BASE로 가짜 서버를 가리킨다. 위치는 저장하지 않는다.
const KAKAO = () => process.env.KAKAO_API_BASE ?? "https://dapi.kakao.com";
const NAVER = () => process.env.FOOD_NAVER_BASE ?? "https://naverapihub.apigw.ntruss.com";
const TTL_MS = 6 * 3_600_000;
const FAIL_TTL_MS = 60_000;
const TIMEOUT_MS = 5_000;
const PAGE_TTL_MS = 24 * 3_600_000;
const PAGE_MAX_BYTES = 1_500_000;
const NEAR_MAX = 200;
// 지역 인기 후보를 모으는 검색어 (네이버 지역 검색은 한 번에 5곳까지라 여러 번 묻는다).
// 백화점·체인을 거르고도 열 곳이 넘게 남도록 식사·카페·술집을 고루 묻는다.
const REGION_QUERIES = ["맛집", "현지인 맛집", "한식 맛집", "고기 맛집", "일식 맛집", "중식 맛집", "양식 맛집", "술집", "카페", "디저트", "빵집", "브런치"];
const TREND = () => process.env.TREND_API_BASE ?? "https://naverapihub.apigw.ntruss.com";
const TREND_TTL_MS = 24 * 3_600_000;
const TREND_WEEKS = 8;

export type FoodResult<T> = { status: "ok"; value: T } | { status: "off" | "forbidden" | "error" };

class Forbidden extends Error {}

export function kakaoEnabled(): boolean {
  return !!process.env.KAKAO_REST_API_KEY;
}

export function naverFoodEnabled(): boolean {
  return !!(process.env.NAVER_SEARCH_CLIENT_ID && process.env.NAVER_SEARCH_CLIENT_SECRET);
}

export function foodEnabled(): boolean {
  return kakaoEnabled() || naverFoodEnabled();
}

const cache = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>();

function remember<T>(key: string, load: () => Promise<T>, ttl = TTL_MS): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as Promise<T>;
  const entry = { at: Date.now(), ttl, value: load() as Promise<unknown> };
  entry.value.catch(() => {
    entry.ttl = FAIL_TTL_MS;
  });
  cache.set(key, entry);
  if (cache.size > 5_000) for (const [k, v] of cache) if (Date.now() - v.at >= v.ttl) cache.delete(k);
  return entry.value as Promise<T>;
}

async function getJson(url: string, headers: Record<string, string>, name: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json", ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  // 카카오맵 사용 설정을 안 켰거나 API HUB 앱에 지역·블로그를 추가하지 않았으면 401·403
  if (res.status === 401 || res.status === 403) throw new Forbidden(`${name} ${res.status}`);
  if (!res.ok) throw new Error(`${name} ${res.status}`);
  return res.json();
}

function kakao(path: string, params: Record<string, string | number>): Promise<unknown> {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return getJson(`${KAKAO()}${path}?${q}`, { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` }, "kakao local");
}

function naver(path: string, params: Record<string, string | number>): Promise<unknown> {
  const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return getJson(
    `${NAVER()}${path}?${q}`,
    { "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_SEARCH_CLIENT_ID!, "X-NCP-APIGW-API-KEY": process.env.NAVER_SEARCH_CLIENT_SECRET! },
    `naver ${path}`,
  );
}

async function settle<T>(work: () => Promise<T>, label: string): Promise<FoodResult<T>> {
  try {
    return { status: "ok", value: await work() };
  } catch (e) {
    if (e instanceof Forbidden) return { status: "forbidden" };
    console.error(`${label}을 못 받았어요`, e instanceof Error ? e.message : e);
    return { status: "error" };
  }
}

/** 한꺼번에 너무 많이 부르지 않도록 n개씩 */
async function mapLimit<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function reviewQuery(p: Pick<FoodPlace, "name" | "address">): string {
  return `${p.name} ${areaOf(p.address)}`.trim();
}

/**
 * 최근 30일 진짜 후기 수 (최신순 100편 중). 그 가게 이야기가 아닌 글, 체험단·협찬 글은 빼고
 * 같은 블로거는 한 번만 센다. 네이버 열쇠가 없거나 못 받으면 0
 */
function recentCount(p: FoodPlace): Promise<number> {
  if (!naverFoodEnabled()) return Promise.resolve(0);
  const today = todayKST();
  return remember(`buzz|${today}|${reviewQuery(p)}`, async () => {
    const json = await naver("/search/v1/blog", { query: reviewQuery(p), display: FOOD_RECENT_CAP, sort: "date" });
    return countBuzz(parseReviews(json), p, today);
  }).catch(() => 0);
}

function withBuzz(list: FoodPlace[]): Promise<BuzzPlace[]> {
  return mapLimit(list, 5, async (p) => ({ ...p, recent: await recentCount(p) }));
}

type NearSort = "distance" | "buzz";

/** 카카오 로컬 여러 쪽 (한 쪽 15곳, 많아야 3쪽 = 45곳). 끝 쪽이면 멈춘다 */
async function kakaoPages(path: string, params: Record<string, string | number>, pages: number): Promise<FoodPlace[]> {
  const out: FoodPlace[] = [];
  for (let page = 1; page <= pages; page++) {
    const json = (await kakao(path, { ...params, size: 15, page })) as { meta?: { is_end?: boolean } };
    out.push(...parseKakaoPlaces(json));
    if (json?.meta?.is_end !== false) break;
  }
  return out;
}

/** 반경을 n×n 칸으로 나눈 사각형들 ("왼쪽 아래 경도,위도,오른쪽 위 경도,위도") — 카카오는 한 번에 45곳까지라 넓은 반경은 나눠 묻는다 */
export function gridRects(at: { lat: number; lng: number }, radius: number, n: number): string[] {
  const dLat = radius / 111_000;
  const dLng = radius / (111_000 * Math.cos((at.lat * Math.PI) / 180));
  const out: string[] = [];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x1 = at.lng - dLng + (2 * dLng * i) / n;
      const y1 = at.lat - dLat + (2 * dLat * j) / n;
      out.push(`${x1.toFixed(6)},${y1.toFixed(6)},${(x1 + (2 * dLng) / n).toFixed(6)},${(y1 + (2 * dLat) / n).toFixed(6)}`);
    }
  return out;
}

/** 두 점 사이 거리 (m) */
function meters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6_371_000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)));
}

/** 분류마다 카카오에 묻는 방법: 식당은 음식점(FD6), 카페·디저트는 카페(CE7)+베이커리, 술집은 "술집" 키워드.
 *  1km 넘게 가까운 순으로 볼 때는 반경을 칸으로 나눠(1km 2×2, 2km 3×3) 칸마다 묻는다 */
function nearSources(kind: FoodKindFilter, at: { lat: number; lng: number }, radius: number, sort: NearSort) {
  // 인기 순은 반경 안에서 고르게 (카카오 정확도 순) 받아 블로그 글 수로 다시 줄 세운다
  const areas: Record<string, string | number>[] =
    sort === "distance" && radius >= 1000
      ? gridRects(at, radius, radius >= 2000 ? 3 : 2).map((rect) => ({ x: at.lng, y: at.lat, rect, sort: "distance" }))
      : [{ x: at.lng, y: at.lat, radius, sort: sort === "distance" ? "distance" : "accuracy" }];
  const cat = (code: string, pages: number) => areas.map((a) => () => kakaoPages("/v2/local/search/category.json", { ...a, category_group_code: code }, pages));
  const kw = (query: string, pages: number) => areas.map((a) => () => kakaoPages("/v2/local/search/keyword.json", { ...a, query, category_group_code: "FD6" }, pages));
  if (kind === "meal") return cat("FD6", 3);
  if (kind === "cafe") return [...cat("CE7", 3), ...kw("베이커리", 1), ...kw("디저트", 1)];
  if (kind === "bar") return [...kw("술집", 3), ...kw("포차", 1)];
  return [...cat("FD6", 3), ...cat("CE7", 2)];
}

export const NEAR_PAGE_SIZE = 20;

function paged<T>(list: T[], page: number) {
  const pages = Math.max(1, Math.ceil(list.length / NEAR_PAGE_SIZE));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { items: list.slice((p - 1) * NEAR_PAGE_SIZE, p * NEAR_PAGE_SIZE), total: list.length, page: p, pages };
}

type NearPlace = BuzzPlace & { kind: FoodKind };

/** 📍 내 주변: 고른 거리(300m~2km)·분류(식당·카페/디저트·술집) 안의 가게 (가까운 순, 또는 최근 블로그 글 많은 순). 20곳씩 쪽 */
export function nearbyPlaces(
  at: { lat: number; lng: number },
  sort: NearSort,
  radius: number = FOOD_RADIUS_M,
  kind: FoodKindFilter = "all",
  page = 1,
): Promise<FoodResult<{ items: NearPlace[]; total: number; page: number; pages: number }>> {
  if (!kakaoEnabled()) return Promise.resolve({ status: "off" });
  return settle(async () => {
    const found = await remember(`near3|${at.lat},${at.lng}|${radius}|${kind}|${sort}`, async () => {
      const lists = await mapLimit(nearSources(kind, at, radius, sort), 6, (load) => load());
      const seen = new Set<string>();
      return lists
        .flat()
        .filter((p) => !seen.has(p.id) && !!seen.add(p.id))
        // 카카오가 준 거리(x,y 기준)를 쓰고, 없으면 직접 잰다
        .map((p) => ({ ...p, distance: p.distance ?? (p.lat !== null && p.lng !== null ? meters(at, { lat: p.lat, lng: p.lng }) : null) }))
        .filter((p) => p.distance === null || p.distance <= radius)
        .map((p) => ({ ...p, kind: placeKind(p.category, p.name) }))
        .filter((p) => kind === "all" || p.kind === kind)
        .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
        .slice(0, NEAR_MAX);
    });
    if (sort === "buzz") {
      // 인기 순: 후보(많아야 45곳 남짓) 모두의 블로그 글 수를 세어 줄 세운 뒤 쪽을 자른다
      return paged(rankByBuzz((await withBuzz(found)) as BuzzPlace[]) as NearPlace[], page);
    }
    const pg = paged(found, page);
    return { ...pg, items: (await withBuzz(pg.items)) as NearPlace[] };
  }, "주변 식당");
}

/**
 * 네이버 데이터랩 검색어 트렌드로 가게마다 요즘 검색 관심도를 잰다.
 * 한 번에 다섯 묶음까지라 묶음마다 "<지역> 맛집"을 기준으로 넣고, 기준 대비 비율로 바꿔 서로 비교한다.
 * 못 받으면 null (순위는 후기 수만 쓴다)
 */
/** 데이터랩 검색어 트렌드: 묶음 이름 → 주간 검색 비율(같은 요청 안에서 가장 큰 값이 100) */
async function trendSeries(groups: { groupName: string; keywords: string[] }[], weeks: number, today: string): Promise<Map<string, number[]>> {
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - weeks * 7);
  const res = await fetch(`${TREND()}/search-trend/v1/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-NCP-APIGW-API-KEY-ID": (process.env.NAVER_TREND_CLIENT_ID || process.env.NAVER_SEARCH_CLIENT_ID)!,
      "X-NCP-APIGW-API-KEY": (process.env.NAVER_TREND_CLIENT_SECRET || process.env.NAVER_SEARCH_CLIENT_SECRET)!,
    },
    body: JSON.stringify({ startDate: start.toISOString().slice(0, 10), endDate: today, timeUnit: "week", keywordGroups: groups }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`search-trend ${res.status}`);
  const json = (await res.json()) as { results?: { title?: string; data?: { ratio?: number }[] }[] };
  return new Map((json.results ?? []).map((r) => [r.title ?? "", (r.data ?? []).map((d) => Number(d.ratio) || 0)]));
}

async function searchInterest(region: string, places: FoodPlace[]): Promise<Map<string, { value: number; rising: boolean }> | null> {
  if (!naverFoodEnabled() || places.length === 0) return null;
  const today = todayKST();
  const anchor = { groupName: "__anchor", keywords: [`${region} 맛집`] };
  const batches: FoodPlace[][] = [];
  for (let i = 0; i < places.length; i += 4) batches.push(places.slice(i, i + 4));
  try {
    const parts = await mapLimit(batches, 3, (batch) =>
      remember(
        `interest|${today}|${region}|${batch.map((p) => p.id).join(",")}`,
        async () => {
          const series = await trendSeries([anchor, ...batch.map((p) => ({ groupName: p.id, keywords: interestKeywords(p) }))], TREND_WEEKS, today);
          const base = summarizeInterest(series.get("__anchor") ?? []).average || 1;
          return batch.map((p) => {
            const s = summarizeInterest(series.get(p.id) ?? []);
            return [p.id, { value: s.average / base, rising: isRising(s) }] as const;
          });
        },
        TREND_TTL_MS,
      ),
    );
    return new Map(parts.flat());
  } catch (e) {
    console.error("맛집 검색 관심도를 못 받았어요", e instanceof Error ? e.message : e);
    return null;
  }
}

export type PlaceInterest = { weeks: number[]; rising: boolean; falling: boolean };

/** 식당 한 곳의 최근 12주 네이버 검색 관심 (가장 많던 주가 100). 검색이 거의 없거나 못 받으면 null */
export function placeInterest(place: FoodPlace): Promise<PlaceInterest | null> {
  if (!naverFoodEnabled()) return Promise.resolve(null);
  const today = todayKST();
  return remember(
    `pinterest|${today}|${place.id}`,
    async () => {
      const weeks = (await trendSeries([{ groupName: "p", keywords: interestKeywords(place) }], 12, today)).get("p") ?? [];
      if (weeks.filter((w) => w > 0).length < 3) return null;
      const s = summarizeInterest(weeks);
      return { weeks, rising: isRising(s), falling: s.before >= 1 && s.recent < s.before * 0.7 };
    },
    TREND_TTL_MS,
  ).catch(() => null);
}

/**
 * 🔥 지역 인기: 후기 많은 곳을 모아 식당·카페·술집만 남기고(백화점·쇼핑몰·큰 체인 빼기),
 * 최근 한 달 진짜 후기 수와 네이버 검색 관심도를 반씩 섞은 순. 분류마다 TOP 10을 고를 수 있게 넉넉히 돌려준다
 */
export function regionHot(region: string): Promise<FoodResult<RankedPlace[]>> {
  if (!naverFoodEnabled()) return Promise.resolve({ status: "off" });
  return settle(async () => {
    const lists = await remember(`region2|${region}`, () =>
      Promise.all(
        REGION_QUERIES.map((q) =>
          naver("/search/v1/local", { query: `${region} ${q}`, display: 5, sort: "comment" }).then(parseNaverPlaces, (e) => {
            if (q === REGION_QUERIES[0]) throw e; // 첫 질문부터 막히면 열쇠·권한 문제로 본다
            return [] as FoodPlace[];
          }),
        ),
      ),
    );
    const candidates = dedupePlaces(lists.flat()).filter(isRegionCandidate);
    const buzz = await withBuzz(candidates);
    const interest = await searchInterest(region, buzz);
    return rankRegion(
      buzz.map((p) => ({
        ...p,
        kind: placeKind(p.category, p.name),
        interest: interest?.get(p.id)?.value ?? null,
        rising: interest?.get(p.id)?.rising ?? false,
      })),
    );
  }, "지역 인기 식당");
}

/** 🔎 식당 찾기: 카카오(음식점+카페 각 15곳, 분류로 거름), 카카오 열쇠가 없으면 네이버 지역 검색 5곳 */
export function searchPlaces(q: string, kind: FoodKindFilter = "all"): Promise<FoodResult<(FoodPlace & { kind: FoodKind })[]>> {
  const tag = (list: FoodPlace[]) =>
    list.map((p) => ({ ...p, kind: placeKind(p.category, p.name) })).filter((p) => kind === "all" || p.kind === kind);
  if (kakaoEnabled()) {
    return settle(async () => {
      const [meal, cafe] = await Promise.all([
        remember(`search|k|${q}`, async () => parseKakaoPlaces(await kakao("/v2/local/search/keyword.json", { query: q, category_group_code: "FD6", size: 15 }))),
        remember(`search|k|ce7|${q}`, async () => parseKakaoPlaces(await kakao("/v2/local/search/keyword.json", { query: q, category_group_code: "CE7", size: 15 }))),
      ]);
      const seen = new Set<string>();
      return tag([...meal, ...cafe].filter((p) => !seen.has(p.id) && !!seen.add(p.id)));
    }, "식당 검색");
  }
  if (naverFoodEnabled()) {
    return settle(async () => tag(await remember(`search|n|${q}`, async () => parseNaverPlaces(await naver("/search/v1/local", { query: q, display: 5 })))), "식당 검색");
  }
  return Promise.resolve({ status: "off" });
}

const pageCache = new Map<string, { at: number; value: Promise<{ image: string | null; sponsor: FoodReview["sponsor"] }> }>();

/** 블로그 글 한 편을 열어 대표 사진과 협찬 표시를 읽는다 (24시간 기억). 못 읽으면 둘 다 null */
function readReviewPage(url: string): Promise<{ image: string | null; sponsor: FoodReview["sponsor"] }> {
  const target = reviewFetchUrl(url);
  if (!target) return Promise.resolve({ image: null, sponsor: null });
  const hit = pageCache.get(target);
  if (hit && Date.now() - hit.at < PAGE_TTL_MS) return hit.value;
  const value = (async () => {
    // 시험은 FOOD_PAGE_BASE로 가짜 서버를 가리킨다
    const res = await fetch(process.env.FOOD_PAGE_BASE ? `${process.env.FOOD_PAGE_BASE}/page?u=${encodeURIComponent(target)}` : target, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BlogvilleBot/1.0; +https://unqiuepcg.java21.net)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    // 다른 사이트로 넘어가면 읽지 않는다
    if (!res.ok || (!process.env.FOOD_PAGE_BASE && !reviewFetchUrl(res.url || target))) return { image: null, sponsor: null };
    const buf = await res.arrayBuffer();
    const html = new TextDecoder().decode(buf.byteLength > PAGE_MAX_BYTES ? buf.slice(0, PAGE_MAX_BYTES) : buf);
    return { image: pickOgImage(html), sponsor: detectSponsor(html) };
  })().catch(() => ({ image: null, sponsor: null }) as const);
  pageCache.set(target, { at: Date.now(), value });
  if (pageCache.size > 3_000) for (const [k, v] of pageCache) if (Date.now() - v.at >= PAGE_TTL_MS) pageCache.delete(k);
  return value;
}

function enrichReviews(list: FoodReview[]): Promise<FoodReview[]> {
  return mapLimit(list, 4, async (r) => ({ ...r, ...(await readReviewPage(r.url)) }));
}

export type PlaceDetail = {
  place: FoodPlace;
  reviews: FoodResult<FoodReview[]>;
  /** 거른 뒤 남은 후기 수와 쪽 (한 쪽 10편, 많아야 10쪽) */
  reviewTotal: number;
  reviewPage: number;
  reviewPages: number;
  /** 이름만 같고 다른 이야기라 뺀 글 수 */
  reviewHidden: number;
  recent: number;
  local: { id: number; title: string; slug: string; nickname: string; createdAt: Date }[];
};

/** 식당 하나: 정보 + 네이버 블로그 후기(관련 높은 순 100편에서 그 식당 이야기만 거른 뒤 쪽마다 10편) + Blogville 이웃 글 */
export async function placeDetail(place: FoodPlace, page = 1): Promise<PlaceDetail> {
  let reviewTotal = 0;
  let reviewHidden = 0;
  let reviewPage = 1;
  let reviewPages = 1;
  const reviews: FoodResult<FoodReview[]> = naverFoodEnabled()
    ? await settle(async () => {
        const all = await remember(`reviews100|${reviewQuery(place)}`, async () =>
          parseReviews(await naver("/search/v1/blog", { query: reviewQuery(place), display: REVIEW_PAGE_SIZE * REVIEW_PAGE_MAX, sort: "sim" })),
        );
        const kept = relevantReviews(all, place);
        reviewHidden = all.length - kept.length;
        reviewTotal = kept.length;
        reviewPages = Math.max(1, Math.min(REVIEW_PAGE_MAX, Math.ceil(kept.length / REVIEW_PAGE_SIZE)));
        reviewPage = Math.min(Math.max(1, Math.floor(page) || 1), reviewPages);
        return enrichReviews(kept.slice((reviewPage - 1) * REVIEW_PAGE_SIZE, reviewPage * REVIEW_PAGE_SIZE));
      }, "블로그 후기")
    : { status: "off" };
  const [recent, local] = await Promise.all([recentCount(place), blogvillePosts(place.name)]);
  return { place, reviews, reviewTotal, reviewPage, reviewPages, reviewHidden, recent, local };
}

/** Blogville 공개 글 중 식당 이름이 든 글 (최신 5편) */
function blogvillePosts(name: string) {
  const pattern = likePattern(name);
  return db
    .select({ id: posts.id, title: posts.title, slug: blogs.slug, nickname: profiles.nickname, createdAt: posts.createdAt })
    .from(posts)
    .innerJoin(blogs, eq(blogs.id, posts.blogId))
    .innerJoin(profiles, eq(profiles.userId, blogs.ownerId))
    .where(and(eq(posts.isPublic, true), or(ilike(posts.title, pattern), ilike(posts.contentText, pattern))))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(5);
}
