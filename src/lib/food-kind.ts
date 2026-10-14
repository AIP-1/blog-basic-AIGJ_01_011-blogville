// 🍽 맛집 분류: 식당 · 카페·디저트 · 술집. 카카오("간식 > 제과,베이커리")·네이버("카페,디저트>베이커리") 분류 글자로 고른다.

export const FOOD_KINDS = [
  { key: "all", label: "전체", icon: "🍽" },
  { key: "meal", label: "식당", icon: "🍚" },
  { key: "cafe", label: "카페·디저트", icon: "🍰" },
  { key: "bar", label: "술집", icon: "🍺" },
] as const;
export type FoodKind = Exclude<(typeof FOOD_KINDS)[number]["key"], "all">;
export type FoodKindFilter = (typeof FOOD_KINDS)[number]["key"];

export function isFoodKind(v: unknown): v is FoodKindFilter {
  return FOOD_KINDS.some((k) => k.key === v);
}

const CAFE = /카페|커피|간식|제과|베이커리|빵|디저트|아이스크림|젤라또|빙수|떡|한과|도넛|와플|케이크|케익|마카롱|초콜릿|쿠키|찻집|전통차|티하우스|티룸|tea|coffee|dessert|bakery/i;
const BAR = /술집|주점|호프|포차|포장마차|이자카야|와인|칵테일|라운지바|(^|[\s>,])바($|[\s>,])|맥주|펍|pub|막걸리|요리주점|바\(BAR\)/i;

/** 분류 글자(·이름) → 식당 / 카페·디저트 / 술집. 모르면 식당 */
export function placeKind(category: string, name = ""): FoodKind {
  if (BAR.test(category)) return "bar";
  if (CAFE.test(category)) return "cafe";
  // 분류가 비었거나 애매하면 이름으로 한 번 더 (예: "OO베이커리", "OO포차")
  if (!category.trim()) {
    if (BAR.test(name)) return "bar";
    if (CAFE.test(name)) return "cafe";
  }
  return "meal";
}

/** 내 주변 거리 고르기 (m) */
export const FOOD_RADII = [300, 500, 1000, 2000] as const;
export type FoodRadius = (typeof FOOD_RADII)[number];
export const DEFAULT_RADIUS: FoodRadius = 500;

export function parseRadius(v: unknown): FoodRadius {
  const n = typeof v === "string" ? Number(v) : NaN;
  return (FOOD_RADII as readonly number[]).includes(n) ? (n as FoodRadius) : DEFAULT_RADIUS;
}

export function radiusLabel(m: number): string {
  return m >= 1000 ? `${m / 1000}km` : `${m}m`;
}
