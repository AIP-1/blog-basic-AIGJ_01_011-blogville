// 🍽 블로그 글 본문이 정말 그 식당 이야기인지: 제목·요약만으로는 "마피아 게임"·"서구사회" 같은 글이 섞이므로,
// 글을 열었을 때 본문에 그 식당의 전화번호·도로명·지도 링크가 있는지 본다.
// 하나라도 있으면 확실한 후기, 없으면 이름과 먹은 이야기가 여러 번 나와야 남기고, 그것도 아니면 뺀다.
import { shortCity, type FoodPlace } from "./food";

export type BodyMatch = "match" | "weak" | "mismatch" | "unknown";

/** 후기에서 뺀 까닭: 제목·요약으로 본 것(food-relevance)과 다른 지역 여행 글, 본문에 그 식당 이야기가 없는 글 */
export type HiddenReason = "spam" | "no-name" | "off-topic" | "other-region" | "body";
export const HIDDEN_LABELS: Record<HiddenReason, string> = {
  spam: "광고·스팸",
  "no-name": "식당 이름 없음",
  "off-topic": "다른 이야기",
  "other-region": "다른 지역 글",
  body: "본문에 이 식당 없음",
};

const squash = (s: string) => s.toLowerCase().replace(/[\s·.,!?'"()[\]{}<>~\-_/|]+/g, "");

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

/** HTML에서 읽을 글자만 (스크립트·스타일은 빼되 지도 카드 등의 data 속성 값은 남긴다) */
export function htmlText(html: string): string {
  const attrs = [...html.matchAll(/data-linkdata\s*=\s*(["'])(.*?)\1/gi)].map((m) => m[2]);
  const body = html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return `${body} ${attrs.join(" ")}`
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? (e.startsWith("#") ? String.fromCharCode(Number(e.slice(1)) || 32) : m))
    .replace(/\s+/g, " ")
    .trim();
}

/** 도로명 낱말 (예: "광주 서구 상무오월로15번길 28-15" → ["상무오월로15번길", "상무오월로"]) */
export function roadWords(address: string): string[] {
  return address
    .split(/\s+/)
    .filter((w) => /^[가-힣][가-힣0-9]*(로|길)$/.test(w) && w.length >= 3)
    .flatMap((w) => {
      const base = w.replace(/\d+(번)?(길|가길)$/, "");
      return base !== w && base.length >= 3 && /(로|길)$/.test(base) ? [w, base] : [w];
    });
}

/** 전화번호가 글에 그대로(붙임표·띄어쓰기는 달라도) 있는지 */
function hasPhone(text: string, phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return false;
  const loose = new RegExp(`(^|\\D)${digits.split("").join("[\\s.\\-)]*")}(\\D|$)`);
  return loose.test(text);
}

// 식당에 다녀온 글에 자주 나오는 말 (흔한 "후기·방문"은 빼고 먹은 이야기만)
const DINING = /메뉴|맛있|먹었|먹어|주문|웨이팅|영업시간|라스트\s*오더|주차|포장|재방문|가격|사장님|매장|테이블|예약|웨이팅|존맛|맛집/g;

/** 본문으로 본 판정. 글이 너무 짧거나 못 읽었으면 unknown */
export function bodyMatch(html: string, place: Pick<FoodPlace, "id" | "name" | "address" | "phone" | "category">): BodyMatch {
  const text = htmlText(html);
  if (text.length < 300) return "unknown";
  if (place.phone && hasPhone(text, place.phone)) return "match";
  const flat = squash(text);
  if (roadWords(place.address).some((w) => flat.includes(squash(w)))) return "match";
  if (/^\d+$/.test(place.id) && new RegExp(`place\\.map\\.kakao\\.com/(m/)?${place.id}(\\D|$)|/place/${place.id}(\\D|$)`).test(html)) return "match";
  const name = squash(place.name.replace(/\s*(본점|지점|[가-힣]+점)$/, ""));
  if (!name) return "unknown";
  const named = flat.split(name).length - 1;
  const menu = place.category ? place.category.split(">").pop()!.trim() : "";
  const dining = new Set([...text.matchAll(DINING)].map((m) => m[0])).size + (menu && text.includes(menu) ? 1 : 0);
  return named >= 2 && dining >= 3 ? "weak" : "mismatch";
}

// 블로그 제목에 자주 나오는 다른 지역 이름 (여행 일기·다른 지점 글에 그 식당 이름이 지나가는 글을 가려낸다).
// 흔한 낱말과 겹치는 이름(공주·부여·진주·동해·남해)은 넣지 않는다
const REGIONS = [
  "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종", "제주", "서귀포", "강릉", "속초", "양양", "춘천", "원주", "평창", "여수", "순천", "목포", "전주",
  "군산", "경주", "포항", "안동", "통영", "거제", "창원", "김해", "청주", "천안", "태안", "보령", "가평", "수원", "담양", "보성", "나주", "광양", "익산", "구미",
  "해남", "완도", "고흥", "울릉", "단양", "제천", "충주", "삼척", "정선", "영월", "의정부", "고양", "용인", "성남", "부천", "안산", "안양", "평택", "김포", "파주",
  "오사카", "도쿄", "후쿠오카", "교토", "삿포로", "다낭", "방콕", "대만", "타이베이", "홍콩",
];
// 블로그에 도시 이름 대신 자주 쓰는 동네 → 속한 시·도 (같은 도시 안의 동네 글은 빼지 않으려고)
const HOODS: Record<string, string> = {
  신촌: "서울", 홍대: "서울", 강남역: "서울", 잠실: "서울", 성수동: "서울", 이태원: "서울", 을지로: "서울", 여의도: "서울", 압구정: "서울", 연남동: "서울",
  판교: "경기", 분당: "경기", 일산: "경기", 동탄: "경기", 송도: "인천", 해운대: "부산", 서면: "부산", 광안리: "부산", 동성로: "대구", 나성동: "세종",
};

/** 제목이 다른 지역 이야기인지 (예: 광주 식당인데 "7/29-31 강릉야호~", "신촌 … 상무초밥 신촌점"). 그 식당 동네 말이 같이 있으면 아니다 */
export function otherRegionTitle(title: string, place: Pick<FoodPlace, "address"> & { name?: string }, localWords: string[]): boolean {
  // 식당 이름 속 지역 낱말("세종한정식", "부산갈매기")은 지역으로 보지 않는다
  const flat = place.name ? squash(title).split(squash(place.name)).join(" ") : squash(title);
  const own = squash(`${place.address} ${shortCity(place.address)}`);
  const other =
    REGIONS.some((r) => flat.includes(r) && !own.includes(r)) ||
    Object.entries(HOODS).some(([hood, city]) => flat.includes(hood) && !own.includes(hood) && !own.includes(city));
  if (!other) return false;
  return !localWords.some((w) => w.length >= 2 && flat.includes(squash(w)));
}
