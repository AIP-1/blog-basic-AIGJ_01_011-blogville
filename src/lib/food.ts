// 🍽 맛집: 카카오 로컬(근처·식당 정보)과 네이버 검색(지역 인기·블로그 후기)을 묶어 보여 준다.
// 이 파일은 서버·화면이 같이 쓰는 모양과 규칙만 둔다.

/** 식당 한 곳. id는 카카오 장소 id(없으면 네이버 이름+주소로 만든 키) */
export type FoodPlace = {
  id: string;
  name: string;
  category: string; // "한식 > 국밥"처럼 마지막 두 단계
  address: string; // 도로명 우선
  phone: string;
  mapUrl: string; // 카카오맵(없으면 네이버 지도 검색) 링크
  lat: number | null;
  lng: number | null;
  distance: number | null; // 미터, 내 주변 탭에서만
};

/** 블로그 후기 한 편 */
export type FoodReview = {
  title: string;
  summary: string;
  url: string;
  blogger: string;
  date: string; // YYYY-MM-DD
  image?: string | null; // 글 대표 사진 (og:image)
  sponsor?: "sponsored" | "self" | null; // 협찬 표시 / 내돈내산 / 모름
  /** 어디서 찾은 글: 네이버 블로그 / 다음 블로그(티스토리·브런치 등) / 다음 카페 */
  source?: ReviewSource;
};

export type ReviewSource = "naver" | "daum" | "cafe";
export const REVIEW_SOURCES: { key: ReviewSource; label: string }[] = [
  { key: "naver", label: "네이버 블로그" },
  { key: "daum", label: "티스토리·다음 블로그" },
  { key: "cafe", label: "다음 카페" },
];

/** 카카오(다음) 검색 blog·cafe documents → 후기. 날짜는 한국 날짜, 사진은 카카오가 준 썸네일 */
export function parseKakaoReviews(json: unknown, source: "daum" | "cafe"): FoodReview[] {
  return rows(json, "documents").flatMap((d) => {
    const url = typeof d.url === "string" && /^https?:\/\//.test(d.url) ? d.url : null;
    const title = cleanText(d.title);
    if (!url || !title) return [];
    const t = typeof d.datetime === "string" ? new Date(d.datetime) : null;
    const date = t && !Number.isNaN(t.getTime()) ? new Date(t.getTime() + 9 * 3_600_000).toISOString().slice(0, 10) : "";
    const thumb = typeof d.thumbnail === "string" && /^https?:\/\//.test(d.thumbnail) ? d.thumbnail.replace(/^http:/, "https:") : null;
    return [
      {
        title,
        summary: cleanText(d.contents),
        url,
        blogger: cleanText(source === "cafe" ? d.cafename : d.blogname),
        date,
        image: thumb,
        sponsor: null,
        source,
      },
    ];
  });
}

/** 같은 글을 한 번만 (네이버 블로그는 PC·모바일 주소가 달라도 같은 글) */
export function reviewKey(url: string): string {
  const m = /blog\.naver\.com\/([A-Za-z0-9_-]+)\/(\d+)/.exec(url);
  if (m) return `naver:${m[1]}/${m[2]}`;
  return url.replace(/^https?:\/\/(www\.|m\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
}

export const FOOD_TABS = [
  { key: "near", label: "📍 내 주변" },
  { key: "region", label: "🔥 지역 인기" },
  { key: "search", label: "🔎 식당 찾기" },
  { key: "saved", label: "⭐ 가고 싶은 곳" },
] as const;
export type FoodTab = (typeof FOOD_TABS)[number]["key"];

export const FOOD_REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "수원", "성남", "고양", "용인", "청주", "전주", "천안", "창원", "포항", "제주",
] as const;

/** 지역 인기를 동네로 좁혀 보기: 도시마다 맛집이 몰린 동네 (검색어 그대로 쓴다) */
export const FOOD_AREAS: Record<(typeof FOOD_REGIONS)[number], readonly string[]> = {
  서울: ["강남역", "성수", "홍대", "연남동", "망원", "이태원", "한남동", "용산", "익선동", "을지로", "여의도", "잠실", "송리단길", "건대", "신촌", "서촌", "문래", "압구정", "가로수길"],
  부산: ["서면", "해운대", "광안리", "남포동", "전포", "기장"],
  대구: ["동성로", "수성못", "대봉동", "앞산"],
  인천: ["송도", "구월동", "부평", "차이나타운"],
  광주: ["동명동", "충장로", "상무지구", "양림동", "첨단"],
  대전: ["둔산동", "은행동", "봉명동", "유성"],
  울산: ["삼산동", "성남동", "울산대"],
  세종: ["나성동", "도담동", "보람동"],
  수원: ["행궁동", "인계동", "광교"],
  성남: ["판교", "정자동", "서현"],
  고양: ["일산", "라페스타", "삼송"],
  용인: ["수지", "기흥", "동백"],
  청주: ["성안길", "율량동", "복대동"],
  전주: ["한옥마을", "객사", "서신동"],
  천안: ["신부동", "불당동"],
  창원: ["상남동", "창원 가로수길", "마산"],
  포항: ["영일대", "죽도시장", "양덕동"],
  제주: ["제주시", "애월", "서귀포", "성산", "협재"],
};

/** 고른 도시의 동네인가 */
export function isFoodArea(region: string, v: unknown): v is string {
  return isFoodRegion(region) && typeof v === "string" && FOOD_AREAS[region].includes(v);
}

/** 글쓰기에 식당 카드를 미리 채우는 주소. /write가 place_* 값을 읽는다 */
export function reviewWriteHref(p: Pick<FoodPlace, "name" | "address" | "mapUrl" | "category">): string {
  const q = new URLSearchParams({ place_name: p.name, place_address: p.address, place_url: p.mapUrl, place_category: p.category });
  return `/write?${q.toString()}`;
}

export const FOOD_RADIUS_M = 1000;
export const FOOD_QUERY_MAX = 30;
export const FOOD_RECENT_DAYS = 30;
export const FOOD_REGION_TOP = 10;
/** 최근 30일 블로그 글이 이만큼 넘으면 🔥 요즘 뜨는 곳 */
export const FOOD_HOT = 30;
/** 블로그 검색은 한 번에 100편까지라 그 이상은 100+로 보여 준다 */
export const FOOD_RECENT_CAP = 100;

export const FOOD_MESSAGES = {
  off: "맛집 기능을 준비하고 있어요. 조금만 기다려 주세요.",
  nearOff: "내 주변 찾기를 준비하고 있어요. 지역 인기와 식당 찾기를 먼저 써 보세요.",
  error: "식당 정보를 잠깐 못 받았어요. 조금 뒤에 다시 해 주세요.",
  forbidden: "식당 정보 열쇠가 아직 연결되지 않았어요.",
  empty: "찾는 식당이 없어요. 이름을 조금 다르게 적어 보세요.",
  nearEmpty: "1km 안에 식당이 안 보여요.",
  regionEmpty: "이 조건에 맞는 곳을 아직 못 찾았어요. 동네나 분류를 바꿔 보세요.",
  denied: "위치 권한이 꺼져 있어요. 브라우저 주소창 왼쪽 자물쇠에서 위치를 허용해 주세요.",
  unsupported: "이 브라우저는 위치를 알려 주지 않아요. 지역 인기에서 동네를 골라 보세요.",
} as const;

export function isFoodTab(v: unknown): v is FoodTab {
  return FOOD_TABS.some((t) => t.key === v);
}

export function isFoodRegion(v: unknown): v is (typeof FOOD_REGIONS)[number] {
  return (FOOD_REGIONS as readonly unknown[]).includes(v);
}

/** 검색어: 앞뒤 빈칸·여러 빈칸 정리, 30자 넘으면 자름. 비면 null */
export function parseFoodQuery(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const q = v.replace(/\s+/g, " ").trim().slice(0, FOOD_QUERY_MAX);
  return q || null;
}

/** 위·경도: 한국 안쪽만 받고 소수 셋째 자리(약 100m)로 줄인다. 아니면 null */
export function parseCoords(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const a = typeof lat === "string" ? Number(lat) : NaN;
  const b = typeof lng === "string" ? Number(lng) : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a < 33 || a > 39 || b < 124 || b > 132) return null;
  return { lat: Math.round(a * 1000) / 1000, lng: Math.round(b * 1000) / 1000 };
}

const ENTITIES: Record<string, string> = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&apos;": "'", "&#39;": "'" };

/** 네이버가 굵게 표시한 <b>와 엔티티를 지운 글자 */
export function cleanText(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;|&#39;/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();
}

/** "음식점 > 한식 > 국밥" → "한식 > 국밥" */
export function shortCategory(raw: unknown): string {
  const parts = cleanText(raw)
    .split(">")
    .map((s) => s.trim())
    .filter((s) => s && s !== "음식점");
  return parts.slice(-2).join(" > ");
}

/** 주소에서 "광주 서구"처럼 시·구 두 마디 (후기 검색을 좁힐 때 쓴다) */
export function areaOf(address: string): string {
  return address.split(" ").slice(0, 2).join(" ");
}

/** 주소 시·도 이름을 짧게: "광주광역시" → "광주" */
export function shortCity(address: string): string {
  return address
    .replace(/^(서울|부산|대구|인천|광주|대전|울산)(특별시|광역시)/, "$1")
    .replace(/^(세종)특별자치시/, "$1")
    // 통합 시("전남광주통합특별시")는 블로그에 흔히 쓰는 도시 이름("광주")으로
    .replace(/^(?:전남|전북|경남|경북|충남|충북|강원|경기)?(서울|부산|대구|인천|광주|대전|울산)?\S*통합특별시/, (m, city) => city ?? m);
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function rows(json: unknown, key: string): Record<string, unknown>[] {
  const list = (json as Record<string, unknown> | null)?.[key];
  return Array.isArray(list) ? list.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

/** 카카오 로컬(키워드·카테고리 검색) documents → 식당 */
export function parseKakaoPlaces(json: unknown): FoodPlace[] {
  return rows(json, "documents").flatMap((d) => {
    const id = typeof d.id === "string" ? d.id : null;
    const name = cleanText(d.place_name);
    if (!id || !name) return [];
    const road = cleanText(d.road_address_name);
    const address = shortCity(road || cleanText(d.address_name));
    const url = typeof d.place_url === "string" && /^https?:\/\//.test(d.place_url) ? d.place_url.replace(/^http:/, "https:") : `https://place.map.kakao.com/${id}`;
    return [
      {
        id,
        name,
        category: shortCategory(d.category_name),
        address,
        phone: cleanText(d.phone),
        mapUrl: url,
        lat: num(d.y),
        lng: num(d.x),
        distance: d.distance === "" || d.distance == null ? null : num(d.distance),
      },
    ];
  });
}

/** 네이버 지역 검색 좌표: 예전 정수(경도×10^7) 모양도 받는다 */
function naverCoord(v: unknown): number | null {
  const n = num(v);
  if (n == null) return null;
  return Math.abs(n) > 1000 ? n / 1e7 : n;
}

/** 네이버 지역 검색 items → 식당 (id는 "n:" + 이름|주소) */
export function parseNaverPlaces(json: unknown): FoodPlace[] {
  return rows(json, "items").flatMap((d) => {
    const name = cleanText(d.title);
    if (!name) return [];
    const address = shortCity(cleanText(d.roadAddress) || cleanText(d.address));
    return [
      {
        id: `n:${name}|${address}`.slice(0, 120),
        name,
        category: shortCategory(d.category),
        address,
        phone: cleanText(d.telephone),
        mapUrl: `https://map.naver.com/p/search/${encodeURIComponent(`${name} ${areaOf(address)}`.trim())}`,
        lat: naverCoord(d.mapy),
        lng: naverCoord(d.mapx),
        distance: null,
      },
    ];
  });
}

/** 네이버 블로그 검색 items → 후기 */
export function parseReviews(json: unknown): FoodReview[] {
  return rows(json, "items").flatMap((d) => {
    const url = typeof d.link === "string" && /^https?:\/\//.test(d.link) ? d.link : null;
    const title = cleanText(d.title);
    if (!url || !title) return [];
    const pd = typeof d.postdate === "string" && /^\d{8}$/.test(d.postdate) ? d.postdate : "";
    return [
      {
        title,
        summary: cleanText(d.description),
        url,
        blogger: cleanText(d.bloggername),
        date: pd ? `${pd.slice(0, 4)}-${pd.slice(4, 6)}-${pd.slice(6, 8)}` : "",
      },
    ];
  });
}

/** 최근 days일 안(오늘 포함, YYYY-MM-DD) 후기 수 */
export function countRecent(reviews: FoodReview[], today: string, days = FOOD_RECENT_DAYS): number {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  const from = d.toISOString().slice(0, 10);
  return reviews.filter((r) => r.date && r.date >= from && r.date <= today).length;
}

/** 이름이 같은 가게를 한 번만 (카카오·네이버가 같은 곳을 다르게 적어도 이름+시·구가 같으면 같은 곳) */
export function dedupePlaces(list: FoodPlace[]): FoodPlace[] {
  const seen = new Set<string>();
  return list.filter((p) => {
    const key = `${p.name.replace(/\s+/g, "")}|${areaOf(p.address)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type BuzzPlace = FoodPlace & { recent: number };

/** 최근 언급 많은 순 (같으면 원래 순서) */
export function rankByBuzz(list: BuzzPlace[]): BuzzPlace[] {
  return list
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.recent - a.p.recent || a.i - b.i)
    .map((x) => x.p);
}

/** "최근 한 달 블로그 23편" / "100편 넘게" */
export function buzzLabel(recent: number): string {
  if (recent >= FOOD_RECENT_CAP) return `최근 한 달 블로그 ${FOOD_RECENT_CAP}편 넘게`;
  return recent > 0 ? `최근 한 달 블로그 ${recent}편` : "최근 한 달 블로그 글 없음";
}

/** 1234 → "1.2km", 340 → "340m" */
export function distanceLabel(m: number | null): string {
  if (m == null) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}
