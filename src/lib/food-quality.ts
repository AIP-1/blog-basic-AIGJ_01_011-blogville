// 🍽 맛집 품질 규칙: 지역 인기에서 식당·디저트가 아닌 곳(백화점·쇼핑몰·큰 체인)을 거르고,
// "요즘 블로그에 많이 올라온 순"을 셀 때 광고·체험단 글과 그 가게와 상관없는 글을 뺀다.
// 순수 함수만 둔다 (서버·시험이 같이 쓴다).
import { FOOD_RECENT_DAYS, type FoodPlace, type FoodReview } from "@/lib/food";
import type { FoodKind } from "@/lib/food-kind";
import { isRelevantReview } from "@/lib/food-relevance";

/** 식당·디저트로 보는 업종 말 (네이버 지역 검색·카카오 분류 둘 다) */
const FOOD_CATEGORY =
  /음식|한식|일식|중식|양식|분식|아시아|퓨전|뷔페|레스토랑|육류|고기|해물|생선|회|초밥|돈가스|국밥|국수|냉면|면요리|찌개|탕|찜|족발|보쌈|치킨|피자|햄버거|버거|샌드위치|샐러드|브런치|스테이크|파스타|이탈리|프랑스|멕시|베트남|태국|인도|쌀국수|카레|라멘|우동|소바|돈부리|덮밥|곱창|막창|닭|오리|장어|조개|게|굴|낙지|주꾸미|만두|떡볶이|순대|김밥|도시락|죽|백반|한정식|술집|주점|이자카야|포차|호프|요리|카페|디저트|베이커리|제과|빵|케이크|도넛|아이스크림|빙수|떡|와플|마카롱|차|커피|전통찻집/;
/** 식당이 아닌 업종 */
const NOT_FOOD_CATEGORY =
  /쇼핑|유통|백화점|쇼핑몰|아울렛|마트|면세|숙박|호텔|리조트|문화|공연|전시|영화|테마파크|레저|스포츠|교육|학원|병원|의료|부동산|관광|명소|공원|시장(?!.*(음식|먹자))/;
/** 이름만 봐도 식당이 아닌 곳 (몰·백화점 지점 등) */
const NOT_FOOD_NAME =
  /백화점|아울렛|면세점|쇼핑몰|스타필드|타임스퀘어|아이파크몰|코엑스몰|이마트|홈플러스|롯데마트|하나로마트|몰\s*\S*점$|호텔$/;

/** 어디서나 볼 수 있는 큰 체인 (지역 인기에서만 뺀다. 내 주변·찾기에는 그대로 둔다) */
const FRANCHISES = [
  "스타벅스",
  "투썸플레이스",
  "이디야",
  "메가커피",
  "메가MGC",
  "빽다방",
  "컴포즈커피",
  "할리스",
  "폴바셋",
  "커피빈",
  "엔제리너스",
  "탐앤탐스",
  "파스쿠찌",
  "공차",
  "맥도날드",
  "버거킹",
  "롯데리아",
  "KFC",
  "맘스터치",
  "서브웨이",
  "노브랜드버거",
  "쉐이크쉑",
  "파리바게뜨",
  "뚜레쥬르",
  "배스킨라빈스",
  "던킨",
  "크리스피크림",
  "설빙",
  "BBQ",
  "BHC",
  "교촌",
  "굽네",
  "네네치킨",
  "처갓집",
  "푸라닭",
  "도미노",
  "피자헛",
  "미스터피자",
  "파파존스",
  "본죽",
  "김밥천국",
  "아웃백",
  "빕스",
  "애슐리",
  "한솥",
  "봉구스",
  "이삭토스트",
  "명랑핫도그",
  "신전떡볶이",
  "엽기떡볶이",
];
const FRANCHISE_RE = new RegExp(
  FRANCHISES.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "i",
);

export function isFranchise(name: string): boolean {
  return FRANCHISE_RE.test(name.replace(/\s+/g, ""));
}

/** 식당·카페·디저트로 볼 수 있는 곳인가 (업종을 모르면 이름으로만 거른다) */
export function isFoodPlace(p: Pick<FoodPlace, "name" | "category">): boolean {
  if (NOT_FOOD_NAME.test(p.name)) return false;
  const c = p.category;
  if (!c) return true;
  if (
    NOT_FOOD_CATEGORY.test(c) &&
    !FOOD_CATEGORY.test(c.split(">").pop() ?? "")
  )
    return false;
  return FOOD_CATEGORY.test(c);
}

/** 지역 인기 후보로 쓸 곳: 식당·디저트이고 큰 체인이 아닌 곳 */
export function isRegionCandidate(
  p: Pick<FoodPlace, "name" | "category">,
): boolean {
  return isFoodPlace(p) && !isFranchise(p.name);
}

/** 비교용 이름: 빈칸·괄호·지점 이름("○○점", "본점")을 뺀다. "영미오리탕 본점" → "영미오리탕" */
export function coreName(name: string): string {
  const n = name
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/\s+\S+점$/, "")
    .replace(/본점$|직영점$/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return n || name.replace(/\s+/g, "").toLowerCase();
}

/** 광고·체험단 글로 보이는 말 (가게 이야기인지는 food-relevance가 가린다) */
const AD_WORDS =
  /체험단|협찬|원고료|소정의|제공\s*받|지원\s*받|업체로부터|업체에서\s*제공|무료로\s*제공|광고\s*(포함|글)|유료\s*광고|서포터즈|기자단|리뷰어\s*모집|체험\s*후기|파트너스|수수료를\s*제공/;
export function isAdLike(r: Pick<FoodReview, "title" | "summary">): boolean {
  return AD_WORDS.test(`${r.title} ${r.summary}`);
}

/** 요즘 많이 올라온 순에 셀 글인가: 그 가게 이야기이고 광고·체험단이 아닌 글 */
export function countsAsBuzz(
  r: Pick<FoodReview, "title" | "summary">,
  p: Pick<FoodPlace, "name" | "address" | "category">,
): boolean {
  return !isAdLike(r) && isRelevantReview(r, p);
}

/** 최근 days일 안의 진짜 후기 수. 같은 블로거가 여러 번 쓴 글은 한 편으로 센다 */
export function countBuzz(
  reviews: FoodReview[],
  p: Pick<FoodPlace, "name" | "address" | "category">,
  today: string,
  days = FOOD_RECENT_DAYS,
): number {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  const from = d.toISOString().slice(0, 10);
  const bloggers = new Set<string>();
  for (const r of reviews) {
    if (!r.date || r.date < from || r.date > today) continue;
    if (!countsAsBuzz(r, p)) continue;
    bloggers.add(r.blogger || r.url);
  }
  return bloggers.size;
}

/** 검색 관심도 요청에 넣을 말: 가게 이름(지점 뺀 것)과 "도시 이름" 묶음 */
export function interestKeywords(
  p: Pick<FoodPlace, "name" | "address">,
): string[] {
  const city = p.address.split(/\s+/)[0] ?? "";
  const base = p.name
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const core = base.replace(/\s+\S+점$/, "").trim();
  const out = new Set<string>([base]);
  if (city) out.add(`${city} ${core}`);
  // 짧고 흔한 이름("마피아")은 다른 뜻 검색이 섞이니 도시를 붙인 말만 쓴다
  if (core.replace(/\s+/g, "").length >= 4) out.add(core);
  else out.delete(base);
  return [...out]
    .map((k) => k.slice(0, 20))
    .filter((k) => k.length >= 2)
    .slice(0, 5);
}

export type InterestPoint = { average: number; recent: number; before: number };

/** 주간 관심도 점들 → 평균(최근 4주)·요즘 2주·그 전 4주 */
export function summarizeInterest(points: number[]): InterestPoint {
  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
  return {
    average: avg(points.slice(-4)),
    recent: avg(points.slice(-2)),
    before: avg(points.slice(-6, -2)),
  };
}

/** 요즘 2주 관심이 그 전보다 30% 넘게 늘었으면 ↑ */
export function isRising(i: InterestPoint): boolean {
  return i.recent >= 1 && i.recent > i.before * 1.3;
}

export type RankedPlace = FoodPlace & {
  recent: number;
  interest: number | null;
  rising: boolean;
  kind: FoodKind;
};

/**
 * 지역 인기 순위: 최근 한 달 진짜 후기 수와 네이버 검색 관심도를 반씩 섞는다.
 * 관심도를 못 받았으면 후기 수만 쓴다. 같으면 원래 순서.
 */
export function rankRegion(list: RankedPlace[]): RankedPlace[] {
  const maxBuzz = Math.max(1, ...list.map((p) => p.recent));
  const withInterest = list.some((p) => p.interest != null && p.interest > 0);
  const maxInt = Math.max(1, ...list.map((p) => p.interest ?? 0));
  const score = (p: RankedPlace) =>
    withInterest
      ? 0.5 * (p.recent / maxBuzz) + 0.5 * ((p.interest ?? 0) / maxInt)
      : p.recent / maxBuzz;
  return list
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
}

/** 카카오 좌표→법정동 응답에서 동네 이름: "성수동1가" → "성수동", 동이 없으면 시군구("수지구") */
export function dongFromRegion(json: unknown): { dong: string; city: string } | null {
  const docs = (json as { documents?: { region_type?: string; region_1depth_name?: string; region_2depth_name?: string; region_3depth_name?: string }[] })?.documents;
  const d = docs?.find((x) => x.region_type === "B") ?? docs?.[0];
  if (!d) return null;
  const three = (d.region_3depth_name ?? "").replace(/\d+가$/, "").replace(/(\D)\d+동$/, "$1동").trim();
  const dong = three.length >= 2 ? three : (d.region_2depth_name ?? "").split(" ").pop() ?? "";
  if (!/^[가-힣]{2,10}$/.test(dong)) return null;
  return { dong, city: (d.region_1depth_name ?? "").replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, "") };
}
