// 🔥 인기 글: 마을 전체에서 기간 안에 많이 읽히고 공감·댓글을 받은 공개 글 (티스토리 인기글처럼)
import { lastDays, todayKST } from "./kst";

/** 인기 글은 이만큼까지 */
export const POPULAR_LIMIT = 30;

/** 점수 = 조회(그 기간에 글을 본 방문자, 하루 1번) + 공감 × 3 + 댓글 × 2 */
export const POPULAR_WEIGHTS = { view: 1, like: 3, comment: 2 } as const;

export const POPULAR_RANGES = ["today", "week", "month"] as const;
export type PopularRange = (typeof POPULAR_RANGES)[number];

export const DEFAULT_POPULAR_RANGE: PopularRange = "week";

/** 탭 이름과 기간 (한국 날짜, 오늘 포함). 이번 주·이번 달은 달력이 아니라 최근 7일·30일이라 월요일·1일에도 비지 않는다 */
export const POPULAR_RANGE_INFO: Record<PopularRange, { label: string; days: number; hint: string }> = {
  today: { label: "오늘", days: 1, hint: "오늘" },
  week: { label: "이번 주", days: 7, hint: "최근 7일" },
  month: { label: "이번 달", days: 30, hint: "최근 30일" },
};

/** 주소의 `?range=`를 탭으로. 모르는 값이나 없으면 이번 주 */
export function parsePopularRange(value: unknown): PopularRange {
  const v = Array.isArray(value) ? value[0] : value;
  return (POPULAR_RANGES as readonly unknown[]).includes(v) ? (v as PopularRange) : DEFAULT_POPULAR_RANGE;
}

/** 기간의 시작: 첫날(`YYYY-MM-DD`, 조회 기록용)과 그날 한국 0시 (공감·댓글·글 시각용) */
export function popularWindow(range: PopularRange, now = new Date()): { startDay: string; startAt: Date } {
  const startDay = lastDays(todayKST(now), POPULAR_RANGE_INFO[range].days)[0];
  return { startDay, startAt: new Date(`${startDay}T00:00:00+09:00`) };
}

export function popularScore(counts: { views: number; likes: number; comments: number }): number {
  return counts.views * POPULAR_WEIGHTS.view + counts.likes * POPULAR_WEIGHTS.like + counts.comments * POPULAR_WEIGHTS.comment;
}

type Ranked = { id: number; score: number; createdAt: Date };

/** 점수가 높은 순, 같으면 새 글(늦게 쓴 글, 그다음 큰 번호)이 먼저 */
export function comparePopular(a: Ranked, b: Ranked): number {
  return b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id;
}
