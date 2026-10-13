import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

// 버그·문의 자동 처리 API의 열쇠 확인 (SUP-04, specs/057-support).
// `Authorization: Bearer <FEEDBACK_BOT_TOKEN>`만 받는다. 쿠키·세션으로는 들어올 수 없다.

/** 열쇠는 32자 이상이어야 API가 켜진다 */
export const BOT_TOKEN_MIN = 32;

export type BotAuth = "disabled" | "unauthorized" | "ok";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * - 환경 변수가 없거나 32자보다 짧으면 `disabled` (API가 없는 것처럼 404)
 * - 헤더가 없거나 `Bearer <열쇠>` 모양이 아니거나 열쇠가 다르면 `unauthorized` (401)
 * 비교는 길이가 같은 해시끼리 timingSafeEqual로 해 걸린 시간으로 열쇠를 알아낼 수 없게 한다.
 */
export function checkBotToken(authorization: string | null, configured: string | undefined): BotAuth {
  const token = configured?.trim() ?? "";
  if (token.length < BOT_TOKEN_MIN) return "disabled";
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  if (!match) return "unauthorized";
  return timingSafeEqual(digest(match[1]), digest(token)) ? "ok" : "unauthorized";
}
