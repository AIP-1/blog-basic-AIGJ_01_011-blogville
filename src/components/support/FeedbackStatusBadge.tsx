import { FEEDBACK_STATUS_LABELS, type FeedbackStatus } from "@/lib/support-rules";

const COLORS: Record<FeedbackStatus, string> = {
  new: "bg-ink/10 text-ink",
  in_progress: "bg-[#fff3d6] text-[#7a4d00]",
  answered: "bg-[#e8f2ec] text-accent",
  fixed: "bg-[#e3f0fb] text-[#0b5394]",
};

/** 문의 상태: 접수 / 확인 중 / 답변 완료 / 고침 (SUP-02·03) */
export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${COLORS[status]}`} data-feedback-status={status}>
      {FEEDBACK_STATUS_LABELS[status]}
    </span>
  );
}
