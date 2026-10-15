// 신고 이름표·글자 수 (화면의 신고 단추가 쓴다). zod를 쓰지 않아 브라우저 묶음에 zod가 딸려 가지 않는다.
export const REPORT_TARGETS = ["post", "comment", "reply", "guestbook"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = { post: "글", comment: "댓글", reply: "답글", guestbook: "방명록" };

export const REPORT_REASONS = ["spam", "abuse", "obscene", "privacy", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "스팸·광고",
  abuse: "욕설·비방",
  obscene: "음란·불쾌",
  privacy: "개인정보 노출",
  other: "기타",
};

export const REPORT_DETAIL_MAX = 300;
/** 한 회원이 1시간에 보낼 수 있는 신고 수 */
export const REPORT_HOURLY_LIMIT = 10;

export const REPORT_MESSAGES = {
  done: "신고했어요. 관리자가 확인할게요",
  already: "이미 신고했어요",
} as const;

export const REPORT_ERRORS = {
  invalid: "요청이 올바르지 않아요",
  reason: "신고 사유를 골라 주세요",
  detail: `기타 사유는 설명을 1~${REPORT_DETAIL_MAX}자로 적어 주세요`,
  notFound: "신고할 내용을 찾지 못했어요",
  own: "내가 쓴 글은 신고할 수 없어요",
  tooMany: "신고가 너무 많아요. 잠시 뒤에 다시 해 주세요",
} as const;

export type ReportInput = { targetType: ReportTarget; targetId: number; reason: ReportReason; detail: string | null };
export type ReportResult = { ok: true; message: string } | { ok: false; error: string };
