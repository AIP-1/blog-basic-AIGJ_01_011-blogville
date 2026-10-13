import { HOUSE_STAGES } from "./house";

// 내 집 지붕 색 (TOWN-07, specs/041-roof-color). 서버와 화면이 같이 쓴다.

/** 색 코드값 10개 (DB CHECK `blogs_roof_color_check`와 같은 순서) */
export const ROOF_CODES = ["red", "orange", "yellow", "green", "sky", "blue", "purple", "brown", "pink", "mint"] as const;
export type RoofCode = (typeof ROOF_CODES)[number];

export const ROOF_LABELS: Record<RoofCode, string> = {
  red: "빨강",
  orange: "주황",
  yellow: "노랑",
  green: "초록",
  sky: "하늘",
  blue: "파랑",
  purple: "보라",
  brown: "갈색",
  pink: "분홍",
  mint: "민트",
};

/** 그림에 쓰는 실제 색 */
export const ROOF_HEX: Record<RoofCode, string> = {
  red: "#d9534f",
  orange: "#f0883e",
  yellow: "#f4d03f",
  green: "#5cb85c",
  sky: "#6ec6f0",
  blue: "#4a6fd9",
  purple: "#9b59b6",
  brown: "#8d6e63",
  pink: "#e67e9a",
  mint: "#1abc9c",
};

export const ROOF_ERRORS = {
  unknown: "고를 수 없는 색이에요.",
  locked: "아직 열리지 않은 색이에요. 집이 한 단계 클 때마다 색이 하나씩 늘어요.",
} as const;

export function isRoofCode(value: unknown): value is RoofCode {
  return typeof value === "string" && (ROOF_CODES as readonly string[]).includes(value);
}

/** 고정 씨앗 난수 (mulberry32) */
function seeded(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 블로그마다 정해진 10색 순서: 블로그 번호를 씨앗으로 섞는다. 첫 색이 가입 때 받은 색이다 */
export function roofOrder(blogId: number): RoofCode[] {
  const order = [...ROOF_CODES];
  const random = seeded(Number.isFinite(blogId) ? blogId : 0);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** 열린 색 수 = 집 단계 (1~10) */
export function unlockedRoofCount(stage: number): number {
  return Math.min(HOUSE_STAGES, Math.max(1, Math.floor(stage) || 1));
}

/** 순서의 `index`번째(0부터) 색이 열리는 레벨: 첫 색 Lv.1, 두 번째 Lv.10 … 열 번째 Lv.90 */
export function roofOpenLevel(index: number): number {
  return Math.max(1, index * 10);
}

/** 지금 지붕 색: 저장한 색이 이상하면(없으면) 순서의 첫 색 */
export function currentRoof(blogId: number, saved: string | null | undefined): RoofCode {
  return isRoofCode(saved) ? saved : roofOrder(blogId)[0];
}

/** 이 블로그가 이 단계에서 고를 수 있는 색인지 */
export function canChooseRoof(blogId: number, stage: number, code: RoofCode): boolean {
  return roofOrder(blogId).slice(0, unlockedRoofCount(stage)).includes(code);
}
