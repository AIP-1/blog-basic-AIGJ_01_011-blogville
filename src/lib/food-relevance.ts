// 🍽 블로그 후기 거르기: 식당 이름만 같고 전혀 다른 이야기(게임·영화 "마피아", 부동산·대출 광고 등)는 빼고,
// 그 식당을 다녀온 글로 보이는 것만 남긴다. 지역 인기·블로그 많이 올라온 순 세기에도 같이 쓴다.
import type { FoodPlace, FoodReview } from "./food";

const squash = (s: string) => s.toLowerCase().replace(/[\s·.,!?'"()[\]{}<>~\-_/|]+/g, "");

// 식당·먹은 이야기에 흔한 말
const FOOD_WORDS = /맛집|식당|메뉴|먹|맛있|맛은|맛이|후기|방문|웨이팅|웨이팅|주문|가격|리뷰|내돈내산|점심|저녁|아침|브런치|술집|카페|디저트|커피|빵|케이크|요리|음식|코스|런치|디너|포장|배달|재방문|존맛|JMT|맛도리|안주|국물|고기|회|초밥|라멘|파스타|피자|버거|치킨|빙수/i;
// 전혀 다른 글 (광고·스팸·다른 분야)
const SPAM = /대출|분양|부동산|아파트\s*매매|청약|카지노|토토|바카라|코인|비트코인|주식\s*리딩|성형|다이어트\s*약|구인|알바\s*모집|체험단\s*모집|서포터즈\s*모집|원고\s*작성\s*알바|중고\s*거래|판매합니다|급매/;
// 이름이 흔한 낱말과 겹칠 때 자주 섞이는 분야
const OFF_TOPIC = /게임|보드게임|마피아\s*게임|영화|드라마|웹툰|소설|애니|넷플릭스|공연|뮤지컬|노래|가사|앨범|아이돌|스포츠|야구|축구|롤|배그|스팀|플레이/;

/** 주소에서 동네 낱말 (예: "광주 동구 금남로 18" → ["동구", "금남로"]). 숫자·시·도는 뺀다 */
export function areaWords(address: string): string[] {
  const parts = address.split(/\s+/);
  const words = parts
    .slice(1)
    .filter((w) => /[가-힣]/.test(w) && !/^\d/.test(w))
    .map((w) => w.replace(/\d+.*$/, ""))
    .filter((w) => w.length >= 2)
    .slice(0, 3);
  // 블로그는 "광주 ○○ 맛집"처럼 도시 이름을 많이 쓴다 (짧은 도시 이름일 때만)
  const city = parts[0] ?? "";
  return /^[가-힣]{2}$/.test(city) ? [...words, city] : words;
}

export type ReviewVerdict = { keep: true } | { keep: false; reason: "spam" | "no-name" | "off-topic" };

export const VERDICT_LABELS = { spam: "광고·스팸", "no-name": "식당 이름 없음", "off-topic": "다른 이야기" } as const;

/** 이 후기가 그 식당 이야기인지와, 아니면 왜 뺐는지 */
export function reviewVerdict(r: Pick<FoodReview, "title" | "summary">, place: Pick<FoodPlace, "name" | "address" | "category">): ReviewVerdict {
  const text = `${r.title} ${r.summary}`;
  if (SPAM.test(text)) return { keep: false, reason: "spam" };
  const name = squash(place.name.replace(/\s*(본점|지점|[가-힣]+점)$/, ""));
  const flat = squash(text);
  if (!name || !flat.includes(name)) return { keep: false, reason: "no-name" };
  const area = areaWords(place.address).some((w) => flat.includes(squash(w)));
  const food = FOOD_WORDS.test(text) || (place.category ? text.includes(place.category.split(">").pop()!.trim()) : false);
  // 이름이 짧거나(3자 이하) 흔한 낱말과 겹치는 다른 분야 이야기가 보이면 동네·먹은 이야기가 둘 다 있어야
  const ok = [...name].length <= 3 || OFF_TOPIC.test(text) ? area && food : area || food;
  return ok ? { keep: true } : { keep: false, reason: "off-topic" };
}

/** 이 후기가 그 식당 이야기인지 (이름이 제목·요약에 있고, 흔한 이름이면 동네·먹은 이야기도 있어야). 광고·스팸은 늘 뺀다 */
export function isRelevantReview(r: Pick<FoodReview, "title" | "summary">, place: Pick<FoodPlace, "name" | "address" | "category">): boolean {
  return reviewVerdict(r, place).keep;
}

/** 후기 목록 거르기 */
export function relevantReviews<T extends Pick<FoodReview, "title" | "summary">>(list: T[], place: Pick<FoodPlace, "name" | "address" | "category">): T[] {
  return list.filter((r) => isRelevantReview(r, place));
}

export const REVIEW_PAGE_SIZE = 10;
/** 후기는 오늘부터 1년 안 글을 모두 (쪽 수는 정하지 않는다) */
export const REVIEW_DAYS = 365;
