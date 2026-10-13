import "server-only";
import { checkBotToken } from "./feedback-bot";

// 버그·문의 자동 처리 API의 공통 응답 (SUP-04, specs/057-support). 쿠키를 보지 않고 열쇠(Bearer)만 본다.

const NO_STORE = { "Cache-Control": "no-store" };

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { ...NO_STORE, ...headers } });

export const apiError = (status: number, error: string) => json({ error }, status);

/** 열쇠가 설정되지 않았으면 API가 없는 것처럼 404 */
export const notFound = () => new Response("Not Found", { status: 404, headers: NO_STORE });

/** 요청의 열쇠를 확인한다. 통과하면 null, 아니면 돌려줄 응답 (404·401) */
export function guardBot(req: Request): Response | null {
  const auth = checkBotToken(req.headers.get("authorization"), process.env.FEEDBACK_BOT_TOKEN);
  if (auth === "disabled") return notFound();
  if (auth === "unauthorized") return json({ error: "열쇠가 없거나 맞지 않아요" }, 401, { "WWW-Authenticate": "Bearer" });
  return null;
}
