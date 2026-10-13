// 신고하기 규칙 (specs/059-report-bookmarks). 서버와 단위 시험이 같이 쓰는 순수 함수만 둔다.
import { z } from "zod";
import { codePointLength } from "./text";

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

const idSchema = z.string().regex(/^[1-9][0-9]{0,9}$/).transform(Number).pipe(z.number().max(2147483647));
const formSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: idSchema,
  reason: z.string(),
  detail: z.string().max(5000).nullable(),
});

/**
 * 신고 폼 값 확인. 대상 종류·ID가 이상하면 invalid, 사유가 목록에 없으면 reason.
 * 기타는 설명(앞뒤 공백을 지우고 1~300자)이 꼭 있어야 하고, 다른 사유의 설명은 버린다.
 */
export function parseReport(input: { targetType: unknown; targetId: unknown; reason: unknown; detail: unknown }): { ok: true; value: ReportInput } | { ok: false; error: string } {
  const parsed = formSchema.safeParse({ ...input, detail: typeof input.detail === "string" ? input.detail : null });
  if (!parsed.success) {
    const onlyReason = parsed.error.issues.every((i) => i.path[0] === "reason");
    return { ok: false, error: onlyReason ? REPORT_ERRORS.reason : REPORT_ERRORS.invalid };
  }
  const { targetType, targetId, reason } = parsed.data;
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) return { ok: false, error: REPORT_ERRORS.reason };
  if (reason !== "other") return { ok: true, value: { targetType, targetId, reason: reason as ReportReason, detail: null } };
  const detail = (parsed.data.detail ?? "").replace(/\r\n?/g, "\n").trim();
  if (detail.length === 0 || codePointLength(detail) > REPORT_DETAIL_MAX) return { ok: false, error: REPORT_ERRORS.detail };
  return { ok: true, value: { targetType, targetId, reason: "other", detail } };
}

/** 최근 1시간에 보낸 신고 수로 더 보낼 수 있는지 */
export function canReportMore(sentLastHour: number): boolean {
  return sentLastHour < REPORT_HOURLY_LIMIT;
}

/**
 * 신고할 수 있는지 (대상을 찾은 뒤): 볼 수 없거나 지워진 것은 notFound, 내가 쓴 것은 own. 할 수 있으면 null.
 * 작성자가 탈퇴해 비어 있는(null) 댓글은 남의 것으로 본다.
 */
export function reportTargetError(target: { visible: boolean; authorId: string | null } | null, reporterId: string): string | null {
  if (!target || !target.visible) return REPORT_ERRORS.notFound;
  if (target.authorId === reporterId) return REPORT_ERRORS.own;
  return null;
}

/** 관리자 신고 목록에서 대상 한 줄의 사유 요약: `스팸·광고 2 · 기타 1` (많은 순, 같으면 목록 순) */
export function summarizeReasons(reasons: readonly ReportReason[]): string {
  const counts = new Map<ReportReason, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || REPORT_REASONS.indexOf(a[0]) - REPORT_REASONS.indexOf(b[0]))
    .map(([r, n]) => `${REPORT_REASON_LABELS[r]} ${n}`)
    .join(" · ");
}

/** 관리자 처리 폼의 대상(`targetType`, `targetId`). 이상하면 null */
export function parseReportTarget(targetType: unknown, targetId: unknown): { targetType: ReportTarget; targetId: number } | null {
  const parsed = z.object({ targetType: z.enum(REPORT_TARGETS), targetId: idSchema }).safeParse({ targetType, targetId });
  return parsed.success ? parsed.data : null;
}

// ── 스크랩 (나중에 읽기) ───────────────────────────────────

export const BOOKMARK_PAGE_SIZE = 10;
