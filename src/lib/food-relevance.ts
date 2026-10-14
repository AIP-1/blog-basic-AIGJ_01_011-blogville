// 🍽 블로그 후기 거르기: 식당 이름만 같고 전혀 다른 이야기(게임·영화 "마피아", 부동산·대출 광고 등)는 빼고,
// 그 식당을 다녀온 글로 보이는 것만 남긴다. 지역 인기·블로그 많이 올라온 순 세기에도 같이 쓴다.
import type { FoodPlace, FoodReview } from "./food";

const squash = (s: string) => s.toLowerCase().replace(/[\s·.,!?'"()[\]{}<>~\-_/|]+/g, "");

// 식당·먹은 이야기에만 나오는 말 ("후기"·"방문"·"리뷰"·"회"처럼 어디에나 나오는 말은 뺐다 — "사회"·"공연 후기"가 걸렸다)
const FOOD_WORDS = /맛집|식당|메뉴|먹었|먹고|먹으|먹을|먹방|맛있|맛은|맛이|웨이팅|주문|내돈내산|점심|저녁|브런치|술집|카페|디저트|커피|빵집|케이크|요리|음식|코스요리|런치|디너|포장|배달|재방문|존맛|JMT|맛도리|안주|국물|고기|횟집|생선회|초밥|라멘|파스타|피자|버거|치킨|빙수|가게|매장|사장님|반찬|웨이팅/i;
// 식당 이름 바로 곁(앞뒤 20자)에 이런 말이 있으면 그 식당 이야기로 본다
const NEAR_FOOD = /맛집|식당|레스토랑|메뉴|주문|웨이팅|런치|디너|점심|저녁|먹|맛있|맛집|가게|매장|본점|지점|사장님|피자|파스타|치킨|고기|국밥|카페|베이커리|빵|디저트|술집|포차|이자카야|후기\s*(입니다|에요|예요|남겨요)|다녀왔|방문했|재방문|배달|포장/;
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
    .slice(0, 3)
    // "목포시"·"해남군"은 블로그에 "목포"·"해남"으로 많이 쓴다
    .flatMap((w) => (/^[가-힣]{2,}(시|군)$/.test(w) ? [w, w.slice(0, -1)] : [w]));
  // 블로그는 "광주 ○○ 맛집"처럼 도시 이름을 많이 쓴다 (짧은 도시 이름일 때만)
  const city = parts[0] ?? "";
  return /^[가-힣]{2}$/.test(city) ? [...words, city] : words;
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 이름 글자 사이 띄어쓰기는 무시 ("영미 오리탕")
const nameRegex = (name: string) => [...name].map(escapeRe).join("\\s*");
// 이름이 다른 것의 이름으로 쓰인 글 ("마피아 게임", "연극 <마피아>")
const NAME_AS_OTHER_AFTER = "\\s*(?:게임|겜|연극|영화|드라마|웹툰|소설|공연|뮤지컬|노래|앨범|보드게임|조직|두목|보스|파티|놀이)";
const NAME_AS_OTHER_BEFORE = "(?:영화|연극|게임|드라마|웹툰|소설|뮤지컬|노래)\\s*[<《「『\"'“]?\\s*";

// 식당이 아닌 업종 (제목이 이런 이야기면 식당 후기가 아니다)
const OTHER_BIZ = /네일|헤어|미용실|미용|피부과|피부관리|병원|의원|치과|한의원|학원|숙소|호텔|펜션|모텔|리조트|부동산|인테리어|웨딩|스튜디오|헬스|필라테스|요가|여행\s*기록|일상|브이로그|vlog/i;

export type ReviewVerdict = { keep: true } | { keep: false; reason: "spam" | "no-name" | "off-topic" };

export const VERDICT_LABELS = { spam: "광고·스팸", "no-name": "식당 이름 없음", "off-topic": "다른 이야기" } as const;

/**
 * 이 후기가 그 식당 이야기인지와, 아니면 왜 뺐는지.
 * - 광고·스팸 → 뺌. 제목·요약에 식당 이름이 없으면 → 뺌
 * - "마피아 게임"·"연극 <마피아>"처럼 이름이 다른 것의 이름으로 쓰였으면 → 뺌 (주소·전화가 그대로 있으면 남김)
 * - 이름 곁(앞뒤 20자)에 먹은 이야기(맛집·메뉴·피자…)가 있거나, 도로명·전화번호가 그대로 있으면 → 남김
 * - 이름이 짧거나(3자 이하) 다른 분야 말이 섞였으면: 도로명·전화가 있거나, 이름 곁 먹은 이야기 + 동네가 둘 다 있어야
 * - 그 밖에는 이름 곁 먹은 이야기, 도로명·전화, 동네+먹은 이야기 중 하나
 */
export function reviewVerdict(
  r: Pick<FoodReview, "title" | "summary">,
  place: Pick<FoodPlace, "name" | "address" | "category"> & { phone?: string },
): ReviewVerdict {
  const text = `${r.title} ${r.summary}`;
  if (SPAM.test(text)) return { keep: false, reason: "spam" };
  const bare = place.name.replace(/\s*(본점|지점|[가-힣]+점)$/, "").trim();
  const name = squash(bare);
  const flat = squash(text);
  if (!name || !flat.includes(name)) return { keep: false, reason: "no-name" };
  const short = [...name].length <= 3;
  const nr = nameRegex(name);
  // 짧은 이름은 더 긴 낱말 속 글자("국가정원"의 정원, "고향에봄"의 봄)를 이름으로 치지 않는다: 바로 앞이 한글이면 아님
  const hits = [...text.matchAll(new RegExp(nr, "g"))].filter((m) => !short || m.index === 0 || !/[가-힣]/.test(text[m.index! - 1]));
  if (hits.length === 0) return { keep: false, reason: "no-name" };
  // 주소의 도로명(○○로·○○길)이나 전화번호가 글에 그대로 있으면 그 가게
  const road = place.address.split(/\s+/).find((w) => /[가-힣]+(로|길)(\d+번?길)?$/.test(w.replace(/\s*\d+(-\d+)?$/, "")));
  const roadWord = road ? road.replace(/\d+번?길$/, "").replace(/\d.*$/, "") : "";
  const digits = (place.phone ?? "").replace(/\D/g, "");
  const exact = (roadWord.length >= 3 && flat.includes(squash(roadWord))) || (digits.length >= 8 && text.replace(/\D/g, "").includes(digits));
  if (!exact && (new RegExp(nr + NAME_AS_OTHER_AFTER).test(text) || new RegExp(NAME_AS_OTHER_BEFORE + nr).test(text))) return { keep: false, reason: "off-topic" };
  // 제목이 다른 업종(네일·미용·숙소·병원…) 이야기이고 제목에 식당 이름이 없으면, 본문에 지나가듯 나온 것
  const inTitle = squash(r.title).includes(name);
  if (!exact && !inTitle && OTHER_BIZ.test(r.title)) return { keep: false, reason: "off-topic" };
  const catWord = place.category ? place.category.split(">").pop()!.trim().split(",")[0] : "";
  // 두 글자 이하 이름("정원"·"봄")은 흔한 낱말이라, 곁에 가게 분류어(한정식·호프…)나 "○○ 식당"·따옴표 이름이 있어야 그 가게
  const tiny = [...name].length <= 2;
  const near = hits.some((m) => {
    const win = text.slice(Math.max(0, m.index! - 15), m.index! + m[0].length + 15);
    const cat = catWord.length >= 2 && win.includes(catWord);
    if (tiny) {
      const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 6);
      const before = text.slice(Math.max(0, m.index! - 1), m.index!);
      const quoted = /['"‘“「『\[<(]/.test(before) && /^['"’”」』\]>)]/.test(after);
      return cat || quoted || /^\s*(식당|맛집|레스토랑|가게|본점|한정식|술집|포차|호프|카페|베이커리)/.test(after);
    }
    return NEAR_FOOD.test(win) || cat;
  });
  const area = areaWords(place.address).some((w) => flat.includes(squash(w)));
  const food = FOOD_WORDS.test(text) || (catWord.length >= 2 && text.includes(catWord));
  const strict = short || OFF_TOPIC.test(text);
  // 짧은 이름은 다른 동네 같은 이름 가게 글도 많아, 이름 곁 먹은 이야기 + 동네(또는 도로명·전화)가 둘 다 있어야.
  // 긴 이름도 제목에 이름이 없으면 곁 먹은 이야기 + 동네가 있어야 (요약 끝에 지나가듯 나온 이름)
  const ok = strict ? exact || (near && area) : exact || (inTitle ? near || (area && food) : near && area);
  return ok ? { keep: true } : { keep: false, reason: "off-topic" };
}

/** 이 후기가 그 식당 이야기인지 (이름이 제목·요약에 있고, 흔한 이름이면 동네·먹은 이야기도 있어야). 광고·스팸은 늘 뺀다 */
export function isRelevantReview(r: Pick<FoodReview, "title" | "summary">, place: Pick<FoodPlace, "name" | "address" | "category"> & { phone?: string }): boolean {
  return reviewVerdict(r, place).keep;
}

/** 후기 목록 거르기 */
export function relevantReviews<T extends Pick<FoodReview, "title" | "summary">>(list: T[], place: Pick<FoodPlace, "name" | "address" | "category"> & { phone?: string }): T[] {
  return list.filter((r) => isRelevantReview(r, place));
}

export const REVIEW_PAGE_SIZE = 10;
/** 후기는 오늘부터 1년 안 글을 모두 (쪽 수는 정하지 않는다) */
export const REVIEW_DAYS = 365;
