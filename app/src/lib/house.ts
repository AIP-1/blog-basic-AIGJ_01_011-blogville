import { MAX_LEVEL } from "./game";
import { withJosa } from "./josa";

// 우리 집 (SHOP-05·BLOG-04·TOWN-04, specs/037-house). 서버와 화면이 같이 쓴다.

/** 집 단계 수 */
export const HOUSE_STAGES = 10;
/** 칸 번호는 0~7 */
export const MAX_FURNITURE_SLOTS = 8;

export const HOUSE_NAMES = [
  "작은 오두막",
  "창문 많은 집",
  "다락 있는 집",
  "꽃밭 있는 집",
  "울타리 있는 집",
  "2층 집",
  "발코니 있는 집",
  "탑 있는 집",
  "정원 있는 저택",
  "마을 최고 저택",
] as const;

/** 집 단계: 10레벨마다 한 단계 (1~10) */
export function houseStage(level: number): number {
  return Math.min(HOUSE_STAGES, Math.floor(Math.max(1, level) / 10) + 1);
}

/** 가구 칸 수: 1단계 4칸, 2단계 6칸, 3단계부터 8칸 */
export function furnitureSlots(stage: number): number {
  return Math.min(MAX_FURNITURE_SLOTS, 2 + 2 * stage);
}

/** 그 칸(0부터)이 열리는 레벨: 4번 칸까지 Lv.1, 5·6번 칸 Lv.10, 7·8번 칸 Lv.20 */
export function slotOpenLevel(slot: number): number {
  const stage = Math.max(1, Math.ceil((slot + 1 - 2) / 2));
  return Math.max(1, (stage - 1) * 10);
}

export type HouseInfo = { stage: number; name: string; slots: number; nextLevel: number | null };

export function houseInfo(level: number): HouseInfo {
  const stage = houseStage(level);
  const next = stage * 10;
  return { stage, name: HOUSE_NAMES[stage - 1], slots: furnitureSlots(stage), nextLevel: stage < HOUSE_STAGES && next <= MAX_LEVEL ? next : null };
}

/** `가구 2/4칸 · Lv.10에 집이 커져요` (마지막 단계면 뒤는 없다) */
export function houseSummary(placed: number, info: HouseInfo): string {
  const base = `가구 ${placed}/${info.slots}칸`;
  return info.nextLevel === null ? base : `${base} · Lv.${info.nextLevel}에 집이 커져요`;
}

export const HOUSE_ERRORS = {
  slot: "놓을 수 없는 자리예요.",
  notOwned: "가진 가구만 놓을 수 있어요.",
  locked: (level: number) => `${withJosa(`Lv.${level}`, "이/가")} 되면 집이 커져서 이 자리를 쓸 수 있어요.`,
} as const;

/** 칸 번호 요청 값: `0`~`7` 한 글자만 */
export function parseSlot(value: unknown): number | null {
  return typeof value === "string" && /^[0-7]$/.test(value) ? Number(value) : null;
}

/** 가입할 때 받는 기본 가구와 놓이는 칸 */
export const STARTER_FURNITURE = [
  { code: "furn_plant", slot: 0 },
  { code: "furn_chair", slot: 1 },
] as const;
