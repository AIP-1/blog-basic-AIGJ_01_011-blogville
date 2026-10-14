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
};

export const FOOD_TABS = [
  { key: "near", label: "📍 내 주변" },
  { key: "region", label: "🔥 지역 인기" },
  { key: "search", label: "🔎 식당 찾기" },
] as const;
export type FoodTab = (typeof FOOD_TABS)[number]["key"];

export const FOOD_REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
  "수원", "성남", "고양", "용인", "청주", "전주", "천안", "창원", "포항", "제주",
] as const;

/** 글쓰기에 식당 카드를 미리 채우는 주소. /write가 place_* 값을 읽는다 */
export function reviewWriteHref(p: Pick<FoodPlace, "name" | "address" | "mapUrl" | "category">): string {
  const q = new URLSearchParams({ place_name: p.name, place_address: p.address, place_url: p.mapUrl, place_category: p.category });
  return `/write?${q.toString()}`;
}
