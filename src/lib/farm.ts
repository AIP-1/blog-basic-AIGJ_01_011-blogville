import { withJosa } from "./josa";

// 동물 농장 (TOWN-09, specs/044-farm): 규칙 숫자와 문구. 서버와 화면이 같이 쓴다.

/** 한 번에 키우는 알·동물 수 */
export const MAX_ACTIVE_ANIMALS = 5;
/** 레벨 보상 알: 이 레벨마다 하나 */
export const EGG_LEVEL_EVERY = 5;
/** 알 값 (코인) */
export const EGG_PRICE = 100;
/** 보상 받는 공개 글 1개당 키우는 동물마다 성장 */
export const POST_GROWTH = 10;

/** 동물 종류: 흔할수록 빨리 자라고 보상이 작다. `weight` 합 100 */
export const SPECIES = {
  chick: { name: "병아리", growth: 60, exp: 50, coin: 20, weight: 40 },
  rabbit: { name: "토끼", growth: 90, exp: 80, coin: 30, weight: 30 },
  piglet: { name: "아기 돼지", growth: 120, exp: 110, coin: 50, weight: 20 },
  calf: { name: "송아지", growth: 160, exp: 160, coin: 80, weight: 10 },
} as const;
export type Species = keyof typeof SPECIES;
export const SPECIES_CODES = Object.keys(SPECIES) as Species[];

/** 하루 한 번씩 하는 돌보기 */
export const CARE_ACTIONS = {
  feed: { button: "🥕 밥 주기", name: "밥 주기", growth: 10 },
  water: { button: "💧 물 주기", name: "물 주기", growth: 10 },
  pet: { button: "🤲 쓰다듬기", name: "쓰다듬기", growth: 5 },
} as const;
export type CareAction = keyof typeof CARE_ACTIONS;
export const CARE_CODES = Object.keys(CARE_ACTIONS) as CareAction[];

export function isSpecies(value: unknown): value is Species {
  return typeof value === "string" && Object.hasOwn(SPECIES, value);
}

export function isCareAction(value: unknown): value is CareAction {
  return typeof value === "string" && Object.hasOwn(CARE_ACTIONS, value);
}

/** 0~99 수로 부화할 종류를 고른다 (비중 순서대로 누적) */
export function pickSpecies(roll: number): Species {
  let acc = 0;
  for (const code of SPECIES_CODES) {
    acc += SPECIES[code].weight;
    if (roll < acc) return code;
  }
  return SPECIES_CODES[SPECIES_CODES.length - 1];
}

export type Stage = "baby" | "teen" | "adult";

/** 단계: 성장치가 1/3 미만이면 아기, 다 자라기 전까지 청소년, 다 자라면 어른 */
export function animalStage(species: Species, growth: number): Stage {
  const full = SPECIES[species].growth;
  if (growth >= full) return "adult";
  return growth * 3 < full ? "baby" : "teen";
}

export const STAGE_LABEL: Record<Stage, string> = { baby: "아기", teen: "청소년", adult: "어른" };

/** 받을 수 있는 레벨 보상 알의 레벨들 (5, 10, … ≤ 지금 레벨, 이미 받은 것 빼고) */
export function levelEggs(level: number, claimed: readonly number[]): number[] {
  const levels: number[] = [];
  for (let l = EGG_LEVEL_EVERY; l <= level; l += EGG_LEVEL_EVERY) if (!claimed.includes(l)) levels.push(l);
  return levels;
}

/** 다 자랐을 때 문구 */
export function grownMessage(species: Species): string {
  const s = SPECIES[species];
  return `🎉 ${withJosa(s.name, "이/가")} 다 자랐어요! 경험치 +${s.exp}, 🪙 +${s.coin}`;
}

export const FARM_ERRORS = {
  full: "한 번에 5마리까지 키울 수 있어요. 다 키운 뒤에 새 알을 받아 주세요",
  claimed: "이미 받은 알이에요",
  notYet: "아직 받을 수 없는 알이에요",
  coins: (short: number) => `코인이 ${short}개 부족해요`,
  notEgg: "부화시킬 수 있는 알이 아니에요",
  notAnimal: "돌볼 수 있는 동물이 아니에요",
  cared: (action: CareAction) => `오늘은 이미 ${withJosa(CARE_ACTIONS[action].name, "을/를")} 했어요`,
} as const;
