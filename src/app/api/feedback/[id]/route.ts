import { z } from "zod";
import { parseId } from "@/lib/ids";
import { checkReply, FEEDBACK_STATUSES } from "@/lib/support-rules";
import { updateFeedback } from "@/server/feedback";
import { apiError, guardBot, json, notFound } from "@/server/feedback-api";

// 버그·문의 자동 처리 API: 상태·답변 바꾸기 (SUP-04, specs/057-support).
// POST /api/feedback/:id  { "status"?: "new"|"in_progress"|"answered"|"fixed", "reply"?: "1~2000자" }
// 답변은 replied_at·replied_by='bot'을 남기고, 새 답변이나 답변 완료·고침이면 쓴 사람에게 알림이 간다.

/** 본문은 16KB까지 (답변 2000자 = UTF-8 최대 8KB) */
const BODY_MAX = 16 * 1024;

const Body = z
  .strictObject({
    status: z.enum(FEEDBACK_STATUSES).optional(),
    reply: z.string().optional(),
  })
  .refine((b) => b.status !== undefined || b.reply !== undefined, { message: "status나 reply 중 하나는 있어야 해요" });

export async function POST(req: Request, ctx: RouteContext<"/api/feedback/[id]">) {
  const denied = guardBot(req);
  if (denied) return denied;
  const id = parseId((await ctx.params).id);
  if (id === null) return apiError(404, "문의를 찾을 수 없어요");

  const text = await req.text();
  if (text.length > BODY_MAX) return apiError(413, "본문이 너무 커요");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return apiError(400, "JSON 본문이 필요해요");
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) return apiError(400, parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; "));

  let reply: string | undefined;
  if (parsed.data.reply !== undefined) {
    const checked = checkReply(parsed.data.reply);
    if (!checked.ok) return apiError(400, checked.error);
    // 자동 처리는 답변을 지우지 않는다
    if (checked.reply === "") return apiError(400, "reply는 1자 이상이어야 해요");
    reply = checked.reply;
  }

  const updated = await updateFeedback(id, { status: parsed.data.status, reply }, "bot");
  if (!updated) return apiError(404, "문의를 찾을 수 없어요");
  return json({
    item: {
      id: updated.id,
      status: updated.status,
      reply: updated.reply,
      repliedAt: updated.repliedAt?.toISOString() ?? null,
      repliedBy: updated.repliedBy,
      notified: updated.notified,
    },
  });
}

export const GET = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
