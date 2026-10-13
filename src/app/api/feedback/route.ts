import { parseLimit, parseStatusList } from "@/lib/support-rules";
import { listFeedbackForBot } from "@/server/feedback";
import { apiError, guardBot, json, notFound } from "@/server/feedback-api";

// 버그·문의 자동 처리 API: 목록 (SUP-04, specs/057-support).
// GET /api/feedback?status=new,in_progress&limit=50  (Authorization: Bearer <FEEDBACK_BOT_TOKEN>)
// → 200 { items: [{ id, kind, title, content, pagePath, userAgent, status, reply, createdAt, author: { username } }] } 오래된 것부터
export async function GET(req: Request) {
  const denied = guardBot(req);
  if (denied) return denied;
  const url = new URL(req.url);
  const statuses = parseStatusList(url.searchParams.get("status"));
  if (!statuses) return apiError(400, "status는 new, in_progress, answered, fixed를 쉼표로 이어 주세요");
  const limit = parseLimit(url.searchParams.get("limit"));
  if (limit === null) return apiError(400, "limit은 1~100이에요");
  return json({ items: await listFeedbackForBot(statuses, limit) });
}

// 다른 방법은 없는 것처럼
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
