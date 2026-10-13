"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { checkFeedback, FEEDBACK_SENT, feedbackPagePath, truncateUserAgent } from "@/lib/support-rules";
import { requireMember } from "@/server/dal";
import { createFeedback } from "@/server/feedback";

// 버그·문의 쓰기 (SUP-02, specs/057-support). 누가 쓰는지는 로그인 세션으로만 정하고,
// 브라우저 정보는 폼이 아니라 요청 헤더에서 서버가 받는다. 보내기 제한(한 시간 5번)도 서버가 센다.

export type SupportResult = { ok: true; message: string } | { ok: false; error: string };

export async function sendFeedback(_prev: SupportResult | null, formData: FormData): Promise<SupportResult> {
  const member = await requireMember();
  const checked = checkFeedback({ kind: formData.get("kind"), title: formData.get("title"), content: formData.get("content") });
  if (!checked.ok) return checked;
  const userAgent = truncateUserAgent((await headers()).get("user-agent"));
  const result = await createFeedback(member.userId, { ...checked.value, pagePath: feedbackPagePath(formData.get("from")), userAgent });
  if (!result.ok) return result;
  revalidatePath("/support");
  return { ok: true, message: FEEDBACK_SENT };
}
