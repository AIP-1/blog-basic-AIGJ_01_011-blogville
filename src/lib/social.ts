// 즐겨찾는 이웃 ⭐ (TOWN-08, SOC-04)
import { lastDays, todayKST } from "./kst";

/** 즐겨찾기는 이만큼까지 (공지사항 블로그는 세지 않는다) */
export const FAVORITE_LIMIT = 10;
/** 이웃 새 글에서 즐겨찾는 이웃의 글을 맨 위로 올리는 기간 (한국 날짜, 오늘 포함) */
export const FAVORITE_WINDOW_DAYS = 7;

export const FAVORITE_MESSAGES = {
  notFound: "이웃을 찾을 수 없어요.",
  notNeighbor: "이웃으로 추가한 사람만 즐겨찾기할 수 있어요.",
  notice: "공지사항 블로그는 즐겨찾기할 수 없어요.",
  full: `즐겨찾기는 ${FAVORITE_LIMIT}명까지예요. 다른 이웃의 ⭐를 먼저 꺼 주세요.`,
} as const;

/** 맨 위로 올릴 글의 시작 시각: 오늘 포함 7일 중 첫날의 한국 0시 */
export function favoriteWindowStart(now = new Date()): Date {
  const first = lastDays(todayKST(now), FAVORITE_WINDOW_DAYS)[0];
  return new Date(`${first}T00:00:00+09:00`);
}

/** 켤 수 있는지: 공지 블로그가 아니고, 공지 블로그를 뺀 즐겨찾기가 10명 미만 (끄기는 늘 된다) */
export function favoriteRefusal(input: { turningOn: boolean; isNotice: boolean; count: number }): string | null {
  if (!input.turningOn) return null;
  if (input.isNotice) return FAVORITE_MESSAGES.notice;
  if (input.count >= FAVORITE_LIMIT) return FAVORITE_MESSAGES.full;
  return null;
}
