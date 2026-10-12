// 경험치·레벨·보상 규칙 (GAME-02·03·05). DB를 쓰지 않는 순수 함수라 화면·서버 어디서나 쓴다.

/** 최고 레벨 (GAME-02) */
export const MAX_LEVEL = 99;

/** 레벨 n이 되는 데 필요한 누적 경험치: `10 × n × (n − 1)` */
export function expForLevel(n: number): number {
  return 10 * n * (n - 1);
}

/** 누적 경험치의 레벨 (1~99) */
export function levelFromExp(exp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && exp >= expForLevel(level + 1)) level++;
  return level;
}

export type LevelProgress = { level: number; current: number; needed: number; ratio: number; isMax: boolean };

/** 지금 레벨 안에서의 진행: 경험치 250이면 Lv.5, `50 / 100` */
export function levelProgress(exp: number): LevelProgress {
  const level = levelFromExp(exp);
  if (level >= MAX_LEVEL) return { level, current: 0, needed: 0, ratio: 1, isMax: true };
  const base = expForLevel(level);
  const needed = expForLevel(level + 1) - base;
  const current = exp - base;
  return { level, current, needed, ratio: current / needed, isMax: false };
}

/** 경험치가 before → after로 바뀔 때 오른 레벨들 (GAME-06에서 쓴다) */
export function levelsGained(before: number, after: number): number[] {
  const from = levelFromExp(before);
  const to = levelFromExp(after);
  return Array.from({ length: Math.max(0, to - from) }, (_, i) => from + i + 1);
}

/** 보상 사유 */
export type RewardReason = "signup" | "attendance" | "post" | "comment" | "like_received" | "farm_care";
/** 원장 사유 (`point_ledger.reason`): 보상, 상점 구매(SHOP-01)·알 사기(TOWN-09)는 코인만 줄어든다, 다 키운 동물 보상 */
export type LedgerReason = RewardReason | "purchase" | "farm_grown" | "egg_purchase" | "growth_purchase";

/** 보상 규칙 표 (GAME-05). 하루는 한국 시간 0시 기준. 출석은 일차별 표(`attendance_rewards`)라 여기 없다 */
export const REWARD_RULES: Record<Exclude<RewardReason, "attendance">, { exp: number; coin: number; dailyLimit: number }> = {
  signup: { exp: 0, coin: 100, dailyLimit: 1 },
  post: { exp: 30, coin: 30, dailyLimit: 3 },
  comment: { exp: 5, coin: 5, dailyLimit: 10 },
  like_received: { exp: 2, coin: 2, dailyLimit: 20 },
  // 동물 돌보기 (TOWN-09): 경험치만, 하루 15번까지
  farm_care: { exp: 2, coin: 0, dailyLimit: 15 },
};

/** 글쓰기 보상을 받는 본문 글자 수 (공개 새 글) */
export const POST_REWARD_MIN_LENGTH = 100;

/** 새 글이 보상 대상인지 (상한은 서버가 원장으로 따로 본다) */
export function postEarnsReward(isNew: boolean, isPublic: boolean, textLength: number): boolean {
  return isNew && isPublic && textLength >= POST_REWARD_MIN_LENGTH;
}

/** 내역 화면의 활동 이름 (GAME-07) */
export const REASON_LABEL: Record<LedgerReason, string> = {
  signup: "🎉 가입 축하",
  attendance: "📮 출석",
  post: "✏️ 글 작성",
  comment: "💬 댓글 작성",
  like_received: "♥ 공감 받음",
  purchase: "🏪 상점 구매",
  farm_care: "🐮 동물 돌보기",
  farm_grown: "🏅 동물 다 키움",
  egg_purchase: "🥚 알 사기",
  growth_purchase: "🌱 성장 아이템 구매",
};

/** 내역 한 페이지 줄 수 */
export const LEDGER_PAGE_SIZE = 20;

/** `1,234` */
export function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 출석 주기 (GAME-04) */
export const ATTENDANCE_CYCLE = 7;

/**
 * 오늘 출석 일차 (1~7). 마지막 출석이 어제면 이어서 +1(7일차 다음은 1), 아니면(없음·하루 이상 빠짐) 1.
 * 날짜는 한국 날짜 `YYYY-MM-DD`.
 */
export function nextCycleDay(last: { date: string; cycleDay: number } | null, today: string, yesterday: string): number {
  if (!last || last.date !== yesterday) return 1;
  return last.cycleDay >= ATTENDANCE_CYCLE ? 1 : last.cycleDay + 1;
}
