import { describe, expect, it } from "vitest";
import {
  canReportMore,
  parseReport,
  parseReportTarget,
  REPORT_DETAIL_MAX,
  REPORT_ERRORS,
  REPORT_HOURLY_LIMIT,
  reportTargetError,
  summarizeReasons,
} from "@/lib/report-rules";

// 신고하기 규칙 (specs/059-report-bookmarks)

const base = { targetType: "post", targetId: "12", reason: "spam", detail: null };

describe("parseReport 신고 폼", () => {
  it("대상·사유가 맞으면 받고, 기타가 아니면 설명은 버린다", () => {
    expect(parseReport({ ...base, detail: "무시됨" })).toEqual({ ok: true, value: { targetType: "post", targetId: 12, reason: "spam", detail: null } });
    for (const t of ["comment", "reply", "guestbook"]) expect(parseReport({ ...base, targetType: t }).ok).toBe(true);
  });

  it("기타는 설명 1~300자가 꼭 있어야 하고 앞뒤 공백을 지운다 (이모지 1개 = 1자)", () => {
    expect(parseReport({ ...base, reason: "other", detail: "  광고 링크  " })).toEqual({
      ok: true,
      value: { targetType: "post", targetId: 12, reason: "other", detail: "광고 링크" },
    });
    expect(parseReport({ ...base, reason: "other", detail: "😀".repeat(REPORT_DETAIL_MAX) }).ok).toBe(true);
    for (const detail of [null, "", "   ", "가".repeat(REPORT_DETAIL_MAX + 1)]) {
      expect(parseReport({ ...base, reason: "other", detail })).toEqual({ ok: false, error: REPORT_ERRORS.detail });
    }
  });

  it("사유가 목록에 없으면 사유 오류", () => {
    for (const reason of [null, "", "hate", 1]) expect(parseReport({ ...base, reason })).toEqual({ ok: false, error: REPORT_ERRORS.reason });
  });

  it("대상 종류·ID가 이상하면 거절", () => {
    for (const bad of [
      { targetType: "user" },
      { targetType: null },
      { targetId: "0" },
      { targetId: "012" },
      { targetId: "-1" },
      { targetId: "1.5" },
      { targetId: "2147483648" },
      { targetId: 12 },
    ]) {
      expect(parseReport({ ...base, ...bad })).toEqual({ ok: false, error: REPORT_ERRORS.invalid });
    }
  });
});

describe("신고할 수 있는지", () => {
  it("없거나 볼 수 없는 것은 찾지 못함, 내 것은 거절, 탈퇴한 작성자(null)는 남의 것", () => {
    expect(reportTargetError(null, "me")).toBe(REPORT_ERRORS.notFound);
    expect(reportTargetError({ visible: false, authorId: "you" }, "me")).toBe(REPORT_ERRORS.notFound);
    expect(reportTargetError({ visible: true, authorId: "me" }, "me")).toBe(REPORT_ERRORS.own);
    expect(reportTargetError({ visible: true, authorId: "you" }, "me")).toBeNull();
    expect(reportTargetError({ visible: true, authorId: null }, "me")).toBeNull();
  });

  it("1시간에 10번까지", () => {
    expect(REPORT_HOURLY_LIMIT).toBe(10);
    expect(canReportMore(0)).toBe(true);
    expect(canReportMore(9)).toBe(true);
    expect(canReportMore(10)).toBe(false);
  });
});

describe("관리자 화면", () => {
  it("사유 요약은 많은 순, 같으면 목록 순", () => {
    expect(summarizeReasons(["other", "spam", "abuse", "spam"])).toBe("스팸·광고 2 · 욕설·비방 1 · 기타 1");
    expect(summarizeReasons([])).toBe("");
  });

  it("처리 폼의 대상", () => {
    expect(parseReportTarget("reply", "7")).toEqual({ targetType: "reply", targetId: 7 });
    expect(parseReportTarget("member", "7")).toBeNull();
    expect(parseReportTarget("post", "07")).toBeNull();
  });
});
