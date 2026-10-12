import { withJosa } from "./josa";

// 연못 낚시터 (TOWN-14, specs/046-fishing): 낚을 것과 무게. 서버와 화면이 같이 쓴다.

export type CatchCode = "minnow" | "crucian" | "carp" | "golden_carp" | "feed" | "boot";

/** 낚을 것 (무게 합 100). `coin`이 없으면 동물 먹이 1개(성장 아이템 `growth_feed`) */
export const CATCHES: readonly { code: CatchCode; emoji: string; name: string; coin: number | null; weight: number; message: string }[] = [
  { code: "minnow", emoji: "🐟", name: "송사리", coin: 5, weight: 25, message: "작고 귀여운 송사리를 낚았어요!" },
  { code: "crucian", emoji: "🐟", name: "붕어", coin: 15, weight: 30, message: "통통한 붕어를 낚았어요!" },
  { code: "carp", emoji: "🐠", name: "잉어", coin: 30, weight: 15, message: "커다란 잉어를 낚았어요!" },
  { code: "golden_carp", emoji: "✨", name: "황금 잉어", coin: 100, weight: 3, message: "반짝반짝 황금 잉어! 오늘 운이 좋아요!" },
  { code: "feed", emoji: "🌱", name: "동물 먹이 꾸러미", coin: null, weight: 15, message: "물에 떠 있던 동물 먹이를 건졌어요! 농장에서 써 보세요." },
  { code: "boot", emoji: "👢", name: "낡은 장화", coin: 1, weight: 12, message: "앗, 낡은 장화예요. 그래도 코인 1개!" },
];

/** 먹이 꾸러미가 주는 성장 아이템 */
export const FEED_ITEM_CODE = "growth_feed";

export function findCatch(code: string) {
  return CATCHES.find((c) => c.code === code) ?? null;
}

/** 0~99 수로 낚을 것을 고른다 (표 순서대로 누적) */
export function pickCatch(roll: number): CatchCode {
  let acc = 0;
  for (const c of CATCHES) {
    acc += c.weight;
    if (roll < acc) return c.code;
  }
  return CATCHES[CATCHES.length - 1].code;
}

/** 받은 것 한 줄: `🪙 30을 받았어요.` / `동물 먹이 1개를 받았어요.` */
export function prizeLine(code: CatchCode): string {
  const c = findCatch(code)!;
  return c.coin === null ? "동물 먹이 1개를 받았어요." : `${withJosa(`🪙 ${c.coin}`, "을/를")} 받았어요.`;
}

/** 오늘 이미 낚았을 때 첫 줄 */
export function todayLine(code: CatchCode): string {
  return `오늘은 ${withJosa(findCatch(code)!.name, "을/를")} 낚았어요.`;
}

export const FISHING_DONE = "오늘은 이미 낚시했어요. 내일 다시 와 주세요!";
