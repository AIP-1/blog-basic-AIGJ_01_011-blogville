// 이번 주 글감 (plaza-upgrade-2): 게시판 쪽지·서랍 보조 줄·/prompt 화면이 같은 글감을 쓴다.
// 한국 시각의 ISO 주(월요일 시작, `2026-W42`)마다 정적 표에서 고른다. 그 주에 특별한 공휴일(한글날 등)이 있으면 특별 글감이 먼저다.
// 운영자 편집은 다음 회차에 site_settings로 옮긴다.

import { HOLIDAYS } from "@/lib/calendar";

export type WeeklyPrompt = { key: string; title: string; hint: string; tag: string };

type PromptSeed = Omit<WeeklyPrompt, "key">;

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

/** 1~52주 글감 (배열 i번 = i+1주). 53주가 있는 해의 마지막 주는 52주 글감을 쓴다 */
export const WEEKLY_PROMPTS: readonly PromptSeed[] = [
  { title: "올해 꼭 해 보고 싶은 것", hint: "크지 않아도 괜찮아요. 올해 해 보고 싶은 일 하나를 적어 보세요.", tag: "새해다짐" },
  { title: "요즘 배우고 있는 것", hint: "요즘 붙잡고 있는 공부나 취미를 소개해 주세요.", tag: "요즘배우는것" },
  { title: "내 책상 풍경", hint: "글을 쓰는 지금 책상 위에 무엇이 있나요?", tag: "내책상" },
  { title: "처음 코드를 짠 날", hint: "처음 화면에 글자를 띄운 날을 떠올려 보세요.", tag: "첫코드" },
  { title: "겨울이면 생각나는 음식", hint: "추운 날 꼭 먹고 싶은 음식과 그 이유를 적어 보세요.", tag: "겨울음식" },
  { title: "내가 자주 쓰는 단축키", hint: "손에 붙은 단축키 하나를 이웃에게 알려 주세요.", tag: "단축키" },
  { title: "요즘 자주 듣는 노래", hint: "한 곡만 골라 언제 듣는지 적어 보세요.", tag: "요즘노래" },
  { title: "오래 붙잡았던 버그 하나", hint: "무엇이 문제였고 어떻게 풀었는지 적어 보세요.", tag: "버그일지" },
  { title: "봄이 오면 하고 싶은 것", hint: "따뜻해지면 가장 먼저 하고 싶은 일을 적어 보세요.", tag: "봄계획" },
  { title: "새 학기, 새 출발", hint: "새로 시작하는 마음가짐을 짧게 남겨 보세요.", tag: "새출발" },
  { title: "동기에게 배운 것", hint: "옆자리 동기에게서 배운 작은 요령을 나눠 주세요.", tag: "동기에게배운것" },
  { title: "내가 아끼는 도구", hint: "매일 쓰는 앱이나 도구 하나를 소개해 주세요.", tag: "도구소개" },
  { title: "산책길에서 본 것", hint: "걷다가 눈에 들어온 장면 하나를 적어 보세요.", tag: "산책" },
  { title: "봄꽃 사진 한 장", hint: "올봄에 만난 꽃 이야기를 사진과 함께 남겨 보세요.", tag: "봄꽃" },
  { title: "실패에서 얻은 것", hint: "잘 안 됐던 일에서 건진 것 하나를 적어 보세요.", tag: "실패기록" },
  { title: "나의 아침 루틴", hint: "일어나서 첫 한 시간을 어떻게 보내나요?", tag: "아침루틴" },
  { title: "최근에 읽은 책", hint: "기억에 남는 한 문장과 함께 소개해 주세요.", tag: "읽은책" },
  { title: "만들어 보고 싶은 작은 프로그램", hint: "시간이 나면 만들고 싶은 것을 적어 보세요.", tag: "만들고싶은것" },
  { title: "어릴 때 꿈", hint: "어릴 때 되고 싶었던 것과 지금의 나를 이어 보세요.", tag: "어릴때꿈" },
  { title: "요즘 고마운 사람", hint: "고맙다고 말하지 못한 사람에게 쓰는 마음으로 적어 보세요.", tag: "고마운사람" },
  { title: "내가 만든 첫 화면", hint: "처음 만든 화면을 지금 다시 보면 어떤가요?", tag: "첫화면" },
  { title: "우리 동네 맛집", hint: "이웃에게 알려 주고 싶은 가게 하나를 소개해 주세요.", tag: "동네맛집" },
  { title: "공부가 잘되는 곳", hint: "집중이 잘되는 자리와 그 이유를 적어 보세요.", tag: "공부장소" },
  { title: "여름에 하고 싶은 것", hint: "이번 여름에 꼭 해 보고 싶은 일을 적어 보세요.", tag: "여름계획" },
  { title: "상반기 돌아보기", hint: "올해 앞쪽 반년에서 기억에 남는 일을 세 가지만 골라 보세요.", tag: "상반기회고" },
  { title: "요즘 빠져 있는 것", hint: "요즘 시간 가는 줄 모르고 하는 일을 소개해 주세요.", tag: "요즘빠진것" },
  { title: "비 오는 날의 기억", hint: "장마철에 있었던 일 하나를 적어 보세요.", tag: "비오는날" },
  { title: "코드 리뷰에서 들은 말", hint: "기억에 남는 리뷰 한마디와 그 뒤에 바꾼 것을 적어 보세요.", tag: "코드리뷰" },
  { title: "가장 반가운 에러 메시지", hint: "보고 나서 오히려 길이 보였던 에러를 소개해 주세요.", tag: "에러메시지" },
  { title: "여름 휴가 이야기", hint: "쉬는 날 다녀온 곳이나 하고 싶은 쉼을 적어 보세요.", tag: "여름휴가" },
  { title: "나만의 공부법", hint: "남들과 조금 다른 나만의 공부 요령이 있나요?", tag: "공부법" },
  { title: "팀 프로젝트 이야기", hint: "함께 만들면서 배운 점을 적어 보세요.", tag: "팀프로젝트" },
  { title: "우리 동네 자랑", hint: "내가 사는 동네의 좋은 점 하나를 알려 주세요.", tag: "동네자랑" },
  { title: "최근에 산 물건", hint: "잘 샀다 싶은 물건과 그 이유를 적어 보세요.", tag: "최근산물건" },
  { title: "혼자 힘으로 푼 문제", hint: "끝까지 붙잡아 풀어낸 문제를 소개해 주세요.", tag: "혼자해결" },
  { title: "가을 하늘", hint: "요즘 올려다본 하늘을 글로 그려 보세요.", tag: "가을하늘" },
  { title: "내가 좋아하는 계절", hint: "어느 계절이 좋은지, 왜 좋은지 적어 보세요.", tag: "좋아하는계절" },
  { title: "다시 보고 싶은 영화", hint: "몇 번을 봐도 좋은 영화 하나를 소개해 주세요.", tag: "다시볼영화" },
  { title: "발표 준비 이야기", hint: "발표나 면접을 앞두고 하는 준비를 나눠 주세요.", tag: "발표준비" },
  { title: "한 달 전의 나에게", hint: "한 달 전의 나에게 해 주고 싶은 말을 적어 보세요.", tag: "한달전의나" },
  { title: "쉽게 설명해 보기", hint: "어려운 개념 하나를 친구에게 말하듯 풀어 보세요.", tag: "쉽게설명하기" },
  { title: "가을에 걷고 싶은 길", hint: "단풍이 물든 길, 자주 걷는 길을 소개해 주세요.", tag: "가을길" },
  { title: "내 블로그 이름의 뜻", hint: "블로그 이름을 지은 이야기를 들려주세요.", tag: "블로그이름" },
  { title: "요즘 하는 고민", hint: "요즘 마음에 걸리는 일을 편하게 적어 보세요.", tag: "요즘고민" },
  { title: "가장 오래 쓴 물건", hint: "오래 곁에 둔 물건과 얽힌 이야기를 적어 보세요.", tag: "오래쓴물건" },
  { title: "배운 것 하나 가르쳐 보기", hint: "이번 주에 배운 것을 이웃에게 가르치듯 적어 보세요.", tag: "가르쳐보기" },
  { title: "겨울 준비", hint: "추워지기 전에 챙기는 것들을 적어 보세요.", tag: "겨울준비" },
  { title: "올해 가장 잘한 일", hint: "스스로 칭찬하고 싶은 일 하나를 골라 보세요.", tag: "올해잘한일" },
  { title: "따뜻한 음료 한 잔", hint: "요즘 자주 마시는 음료와 그 시간을 적어 보세요.", tag: "따뜻한음료" },
  { title: "연말에 듣는 노래", hint: "한 해 끝에 꼭 듣는 노래를 소개해 주세요.", tag: "연말노래" },
  { title: "올해의 사진 한 장", hint: "올해 찍은 사진 중 하나를 골라 이야기를 붙여 보세요.", tag: "올해의사진" },
  { title: "한 해 돌아보기", hint: "올해 가장 기억에 남는 순간을 적어 보세요.", tag: "한해회고" },
];

/** 공휴일 이름(HOLIDAYS의 값) → 그 주의 특별 글감. 연휴·대체공휴일은 이름이 달라 고르지 않는다 */
export const HOLIDAY_PROMPTS: Readonly<Record<string, PromptSeed>> = {
  설날: { title: "설에 있었던 일", hint: "올해 설에 만난 사람, 먹은 음식, 들은 말을 적어 보세요.", tag: "설날" },
  어린이날: { title: "어릴 때 좋아한 놀이", hint: "어릴 때 해가 질 때까지 하던 놀이를 떠올려 보세요.", tag: "어릴때놀이" },
  추석: { title: "명절에 먹은 음식", hint: "이번 추석 상에 오른 음식 하나를 소개해 주세요.", tag: "추석" },
  한글날: { title: "내가 좋아하는 우리말", hint: "소리나 뜻이 예뻐서 아끼는 우리말 하나를 소개해 주세요.", tag: "우리말" },
  성탄절: { title: "주고 싶은 선물", hint: "올해 누군가에게 주고 싶은 선물을 적어 보세요.", tag: "선물" },
};

/** 한국 시각 날짜(자정, UTC로 표시)의 ISO 주: 그 주 목요일의 해가 주의 해 */
function isoWeekOf(kstMidnight: Date): { year: number; week: number; monday: Date } {
  const dow = (kstMidnight.getUTCDay() + 6) % 7; // 월 0 … 일 6
  const monday = new Date(kstMidnight.getTime() - dow * DAY_MS);
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS);
  const week = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * DAY_MS)) + 1;
  return { year, week, monday };
}

function kstMidnight(now: Date): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

/** `now`가 속한 한국 시각 ISO 주 키 (`2026-W42`) */
export function weekKey(now: Date): string {
  const { year, week } = isoWeekOf(kstMidnight(now));
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** 주 키 모양만 (`2026-W42`, 1~53주) */
export function parseWeekKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^(20\d\d)-W(\d\d)$/.exec(value);
  if (!m) return null;
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  // 53주가 없는 해의 W53은 다음 해 W01이라 받지 않는다
  return weekKey(weekRange(value).start) === value ? value : null;
}

/** 주 키의 시작(월요일 0시 KST)과 끝(다음 월요일 0시 KST, 포함하지 않음) */
export function weekRange(key: string): { start: Date; end: Date } {
  const [y, w] = key.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const week1Monday = jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * DAY_MS;
  const startKst = week1Monday + (w - 1) * 7 * DAY_MS;
  return { start: new Date(startKst - KST_OFFSET_MS), end: new Date(startKst + 7 * DAY_MS - KST_OFFSET_MS) };
}

/** 주 키의 글감. 그 주(월~일)에 특별 공휴일이 있으면 특별 글감 */
export function promptForWeek(key: string): WeeklyPrompt {
  const { start } = weekRange(key);
  const mondayKst = start.getTime() + KST_OFFSET_MS;
  for (let d = 0; d < 7; d++) {
    const day = new Date(mondayKst + d * DAY_MS).toISOString().slice(0, 10);
    const special = HOLIDAY_PROMPTS[HOLIDAYS[day] ?? ""];
    if (special) return { key, ...special };
  }
  const week = Number(key.slice(-2));
  return { key, ...WEEKLY_PROMPTS[Math.min(week, WEEKLY_PROMPTS.length) - 1] };
}

/** `now`가 속한 주의 글감 */
export function currentPrompt(now: Date = new Date()): WeeklyPrompt {
  return promptForWeek(weekKey(now));
}

/** 글감 글에 붙는 태그 (`글감`과 그 주의 태그) */
export const PROMPT_TAG = "글감";

/** /write?topic= 의 미리 채우는 태그 줄 */
export function promptTags(prompt: WeeklyPrompt): string {
  return `${PROMPT_TAG}, ${prompt.tag}`;
}

/** 주 키를 사람이 읽는 기간으로 (`10월 12일 ~ 10월 18일`) */
export function weekLabel(key: string): string {
  const { start } = weekRange(key);
  const mon = new Date(start.getTime() + KST_OFFSET_MS);
  const sun = new Date(mon.getTime() + 6 * DAY_MS);
  const f = (d: Date) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return `${f(mon)} ~ ${f(sun)}`;
}
