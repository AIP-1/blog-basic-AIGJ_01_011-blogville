"use client";

import { useActionState, useId, useState } from "react";
import { adminUpdateFeedback, type FeedbackAdminResult } from "@/app/admin/actions";
import { FEEDBACK_REPLY_MAX, FEEDBACK_STATUS_LABELS, FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/support-rules";

/** 관리자 문의 처리 칸 (SUP-03): 상태와 답변. 답변을 비우고 저장하면 답변을 지운다 */
export function FeedbackAdminForm({ id, status, reply }: { id: number; status: FeedbackStatus; reply: string | null }) {
  const [state, action, pending] = useActionState<FeedbackAdminResult | null, FormData>(adminUpdateFeedback, null);
  const uid = useId();
  // 칸은 상태로 쥔다: 저장하면 서버 값(props)으로 다시 맞추고, 실패하면 쓴 내용이 남는다
  const [picked, setPicked] = useState(status);
  const [text, setText] = useState(reply ?? "");
  const [saved, setSaved] = useState({ status, reply });
  if (saved.status !== status || saved.reply !== reply) {
    setSaved({ status, reply });
    setPicked(status);
    setText(reply ?? "");
  }
  return (
    <form action={action} className="space-y-2" aria-label="문의 처리">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="prevStatus" value={status} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${uid}-status`} className="font-semibold">
          상태
        </label>
        <select id={`${uid}-status`} name="status" value={picked} onChange={(e) => setPicked(e.target.value as FeedbackStatus)} className="field field-auto">
          {FEEDBACK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FEEDBACK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${uid}-reply`} className="mb-1 block font-semibold">
          답변
        </label>
        <textarea id={`${uid}-reply`} name="reply" rows={3} maxLength={FEEDBACK_REPLY_MAX} value={text} onChange={(e) => setText(e.target.value)} className="field" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "저장 중..." : "저장"}
        </button>
        <p role="status" className={state && !state.ok ? "text-danger" : "text-accent"}>
          {state ? (state.ok ? state.message : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
