"use client";

import { useId, useRef, useState, useTransition } from "react";
import { reportContent } from "@/app/blog/report-actions";
import { REPORT_DETAIL_MAX, REPORT_REASON_LABELS, REPORT_REASONS, REPORT_TARGET_LABELS, type ReportResult, type ReportTarget } from "@/lib/report-rules";

type Props = { targetType: ReportTarget; targetId: number; className?: string };

/**
 * 🚨 신고 (specs/059-report-bookmarks): 작은 버튼을 누르면 브라우저 기본 대화 상자(<dialog>)에 사유를 고르는 폼이 열린다.
 * 보낸 결과(`신고했어요…`·`이미 신고했어요`·오류)는 대화 상자 안에 보인다. 신고할 수 있는지는 서버가 다시 본다.
 */
export function ReportButton({ targetType, targetId, className = "btn btn-ghost px-2 text-sm text-ink-soft" }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [pending, start] = useTransition();
  const id = useId();
  const label = REPORT_TARGET_LABELS[targetType];

  const open = () => {
    setResult(null);
    setReason("");
    dialog.current?.showModal();
  };

  return (
    <>
      <button type="button" className={className} onClick={open} aria-haspopup="dialog" data-report-open={`${targetType}:${targetId}`}>
        🚨 신고
      </button>
      <dialog ref={dialog} aria-labelledby={`${id}-title`} className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-line bg-surface p-5 text-ink backdrop:bg-black/40" data-report-dialog>
        <h2 id={`${id}-title`} className="text-lg font-bold">
          🚨 {label} 신고
        </h2>
        {result?.ok ? (
          <div className="mt-3 space-y-3">
            <p role="status" className="font-semibold text-accent" data-report-result>
              {result.message}
            </p>
            <div className="flex justify-end">
              <button type="button" className="btn" onClick={() => dialog.current?.close()}>
                닫기
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mt-3 space-y-3"
            // 폼 액션(action=)은 끝나면 폼을 비워 고른 사유가 풀린다. 실패해도 고른 값·설명이 남도록 직접 보낸다
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              start(async () => setResult(await reportContent(formData)));
            }}
          >
            <input type="hidden" name="targetType" value={targetType} />
            <input type="hidden" name="targetId" value={targetId} />
            <label className="block space-y-1">
              <span className="text-sm font-semibold">신고 사유</span>
              <select name="reason" required className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="" disabled>
                  사유를 골라 주세요
                </option>
                {REPORT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {REPORT_REASON_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>
            {reason === "other" && (
              <label className="block space-y-1">
                <span className="text-sm font-semibold">설명</span>
                <textarea name="detail" required maxLength={REPORT_DETAIL_MAX} rows={3} className="field resize-y" placeholder={`어떤 문제인지 적어 주세요 (${REPORT_DETAIL_MAX}자까지)`} />
              </label>
            )}
            {result && !result.ok && (
              <p role="alert" className="form-error">
                {result.error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn" onClick={() => dialog.current?.close()}>
                취소
              </button>
              <button type="submit" className="btn btn-danger" disabled={pending}>
                {pending ? "보내는 중..." : "신고하기"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
