"use client";

import { useActionState, useState } from "react";
import { sendFeedback, type SupportResult } from "@/app/support/actions";
import { FEEDBACK_CONTENT_MAX, FEEDBACK_KIND_LABELS, FEEDBACK_KINDS, FEEDBACK_TITLE_MAX, type FeedbackKind } from "@/lib/support-rules";

/** 버그·문의 쓰기 칸 (SUP-02). 검사는 서버가 다시 한다. 보내면 칸을 비우고 접수 문구를 보여 준다 */
export function SupportForm({ from }: { from: string | null }) {
  const [state, action, pending] = useActionState<SupportResult | null, FormData>(sendFeedback, null);
  // 칸은 상태로 쥐고 있어 실패하면 쓴 내용이 남는다. 접수되면 비운다
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shown, setShown] = useState(state);
  if (state !== shown) {
    setShown(state);
    if (state?.ok) {
      setKind("bug");
      setTitle("");
      setContent("");
    }
  }

  return (
    <form action={action} className="space-y-3" aria-label="버그·문의 쓰기">
      {from && <input type="hidden" name="from" value={from} />}
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-1 font-semibold">종류</legend>
        {FEEDBACK_KINDS.map((k) => (
          <label key={k} className="btn btn-choice cursor-pointer">
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="size-4 accent-[var(--accent)]" />
            {FEEDBACK_KIND_LABELS[k]}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor="support-title" className="mb-1 block font-semibold">
          제목
        </label>
        <input
          id="support-title"
          name="title"
          required
          maxLength={FEEDBACK_TITLE_MAX}
          className="field"
          autoComplete="off"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="support-content" className="mb-1 block font-semibold">
          내용
        </label>
        <textarea
          id="support-content"
          name="content"
          required
          rows={6}
          maxLength={FEEDBACK_CONTENT_MAX}
          className="field"
          placeholder="어떤 화면에서 무엇을 했을 때 어떻게 되었는지 적어 주시면 빨리 고칠 수 있어요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <p className="mt-1 text-right text-sm text-ink-soft" aria-live="polite">
          {[...content].length}/{FEEDBACK_CONTENT_MAX}자
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "보내는 중..." : "보내기"}
        </button>
        <p role="status" className={state && !state.ok ? "text-danger" : "text-accent"} data-support-result>
          {state ? (state.ok ? state.message : state.error) : ""}
        </p>
      </div>
    </form>
  );
}
