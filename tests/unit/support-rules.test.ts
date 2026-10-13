import { describe, expect, it } from "vitest";
import { feedbackNotificationText, FEEDBACK_NOTIFICATION_HREF } from "@/lib/notifications";
import { hasNewRelease } from "@/lib/releases";
import {
  checkFeedback,
  checkReply,
  FEEDBACK_ERRORS,
  feedbackPagePath,
  isRateLimited,
  nextStatus,
  parseLimit,
  parseStatusList,
  rateWindowStart,
  shouldNotifyReply,
  supportHref,
  truncateUserAgent,
} from "@/lib/support-rules";
import { checkBotToken } from "@/server/feedback-bot";

// 버그·문의 규칙 (SUP-01~04, specs/057-support)
describe("checkFeedback", () => {
  const ok = { kind: "bug", title: "글이 안 보여요", content: "내 블로그에서 글이 안 보여요" };

  it("버그·문의 종류와 제목·내용을 받고 앞뒤 공백과 줄바꿈을 정리한다", () => {
    expect(checkFeedback({ ...ok, title: "  제목\n둘째 줄 ", content: "\r\n본문\r\n둘째 \r\n" })).toEqual({
      ok: true,
      value: { kind: "bug", title: "제목 둘째 줄", content: "본문\n둘째" },
    });
    expect(checkFeedback({ ...ok, kind: "question" }).ok).toBe(true);
  });

  it("모르는 종류·빈 제목·빈 내용·문자열이 아닌 값은 거절한다", () => {
    expect(checkFeedback({ ...ok, kind: "praise" })).toEqual({ ok: false, error: FEEDBACK_ERRORS.kind });
    expect(checkFeedback({ ...ok, kind: null })).toEqual({ ok: false, error: FEEDBACK_ERRORS.kind });
    expect(checkFeedback({ ...ok, title: "   " })).toEqual({ ok: false, error: FEEDBACK_ERRORS.titleEmpty });
    expect(checkFeedback({ ...ok, content: "\n \n" })).toEqual({ ok: false, error: FEEDBACK_ERRORS.contentEmpty });
    expect(checkFeedback({ ...ok, title: null })).toEqual({ ok: false, error: FEEDBACK_ERRORS.invalid });
  });

  it("제목은 100자, 내용은 2000자까지 (이모지도 1자)", () => {
    expect(checkFeedback({ ...ok, title: "가".repeat(100) }).ok).toBe(true);
    expect(checkFeedback({ ...ok, title: "🐞".repeat(100) }).ok).toBe(true);
    expect(checkFeedback({ ...ok, title: "가".repeat(101) })).toEqual({ ok: false, error: FEEDBACK_ERRORS.titleTooLong });
    expect(checkFeedback({ ...ok, content: "😀".repeat(2000) }).ok).toBe(true);
    expect(checkFeedback({ ...ok, content: "가".repeat(2001) })).toEqual({ ok: false, error: FEEDBACK_ERRORS.contentTooLong });
  });
});

describe("checkReply", () => {
  it("2000자까지, 빈 답변은 빈 글자(지우기)", () => {
    expect(checkReply("  고쳤어요 \r\n")).toEqual({ ok: true, reply: "고쳤어요" });
    expect(checkReply("   ")).toEqual({ ok: true, reply: "" });
    expect(checkReply("가".repeat(2000)).ok).toBe(true);
    expect(checkReply("가".repeat(2001))).toEqual({ ok: false, error: FEEDBACK_ERRORS.replyTooLong });
  });
});

describe("feedbackPagePath·supportHref", () => {
  it("이 사이트 안의 주소만 남긴다", () => {
    expect(feedbackPagePath("/@bori/12?x=1#comments")).toBe("/@bori/12?x=1#comments");
    expect(feedbackPagePath("/")).toBe("/");
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "/..//evil.com", "javascript:alert(1)", "", null, 3, "/a\nb"]) {
      expect(feedbackPagePath(bad)).toBeNull();
    }
  });

  it("문의 화면 자신은 남기지 않는다", () => {
    expect(feedbackPagePath("/support")).toBeNull();
    expect(feedbackPagePath("/support?from=%2Ffeed")).toBeNull();
    expect(feedbackPagePath("/supporters")).toBe("/supporters");
  });

  it("버튼 주소: 보던 주소를 ?from=으로, 문의 화면에서는 붙이지 않는다", () => {
    expect(supportHref("/@bori/12")).toBe("/support?from=%2F%40bori%2F12");
    expect(supportHref("/")).toBe("/support?from=%2F");
    expect(supportHref("/support")).toBe("/support");
  });
});

describe("truncateUserAgent", () => {
  it("제어 문자를 빼고 300자까지, 비면 null", () => {
    expect(truncateUserAgent("Mozilla/5.0\n(Mac)")).toBe("Mozilla/5.0(Mac)");
    expect(truncateUserAgent("a".repeat(400))).toHaveLength(300);
    expect(truncateUserAgent("")).toBeNull();
    expect(truncateUserAgent(null)).toBeNull();
    expect(truncateUserAgent("  ")).toBeNull();
  });
});

describe("보내기 제한 (한 시간 5번)", () => {
  it("구간은 지금부터 정확히 한 시간 전부터", () => {
    const now = new Date("2026-10-13T12:00:00Z");
    expect(rateWindowStart(now).toISOString()).toBe("2026-10-13T11:00:00.000Z");
  });

  it("이미 5번 보냈으면 6번째를 막는다", () => {
    expect(isRateLimited(0)).toBe(false);
    expect(isRateLimited(4)).toBe(false);
    expect(isRateLimited(5)).toBe(true);
    expect(isRateLimited(9)).toBe(true);
  });
});

describe("상태 바꾸기·알림", () => {
  it("상태를 정해 보내면 그 값", () => {
    expect(nextStatus("new", { status: "in_progress" })).toBe("in_progress");
    expect(nextStatus("fixed", { status: "new" })).toBe("new");
    expect(nextStatus("answered", { status: "fixed", reply: "고쳤어요" })).toBe("fixed");
  });

  it("상태 없이 새 답변만 달면 접수·확인 중은 답변 완료가 되고, 고침은 그대로", () => {
    expect(nextStatus("new", { reply: "답" })).toBe("answered");
    expect(nextStatus("in_progress", { reply: "답" })).toBe("answered");
    expect(nextStatus("fixed", { reply: "답" })).toBe("fixed");
    expect(nextStatus("new", { reply: "" })).toBe("new");
    expect(nextStatus("in_progress", {})).toBe("in_progress");
  });

  it("새 답변·바뀐 답변, 또는 답변 완료·고침으로 바뀌면 알린다", () => {
    expect(shouldNotifyReply({ status: "new", reply: null }, { status: "answered", reply: "답" })).toBe(true);
    expect(shouldNotifyReply({ status: "answered", reply: "답" }, { status: "answered", reply: "고친 답" })).toBe(true);
    expect(shouldNotifyReply({ status: "in_progress", reply: null }, { status: "fixed", reply: null })).toBe(true);
    expect(shouldNotifyReply({ status: "new", reply: null }, { status: "answered", reply: null })).toBe(true);
  });

  it("확인 중으로만 바꾸거나, 같은 답변을 다시 저장하거나, 답변을 지우면 알리지 않는다", () => {
    expect(shouldNotifyReply({ status: "new", reply: null }, { status: "in_progress", reply: null })).toBe(false);
    expect(shouldNotifyReply({ status: "answered", reply: "답" }, { status: "answered", reply: "답" })).toBe(false);
    expect(shouldNotifyReply({ status: "answered", reply: "답" }, { status: "answered", reply: null })).toBe(false);
    expect(shouldNotifyReply({ status: "fixed", reply: null }, { status: "new", reply: null })).toBe(false);
  });

  it("알림 문구와 주소", () => {
    expect(feedbackNotificationText("글이 안 보여요")).toBe("🐞 문의에 답변이 달렸어요: 글이 안 보여요");
    expect(FEEDBACK_NOTIFICATION_HREF).toBe("/support");
  });
});

describe("자동 처리 API 조건", () => {
  it("?status=: 쉼표로 나눈 상태, 비면 전체, 모르는 값이면 null", () => {
    expect(parseStatusList("new,in_progress")).toEqual(["new", "in_progress"]);
    expect(parseStatusList(" new , new ")).toEqual(["new"]);
    expect(parseStatusList(null)).toEqual(["new", "in_progress", "answered", "fixed"]);
    expect(parseStatusList("")).toHaveLength(4);
    expect(parseStatusList("new,done")).toBeNull();
    expect(parseStatusList("new,")).toBeNull();
  });

  it("?limit=: 1~100, 없으면 50", () => {
    expect(parseLimit(null)).toBe(50);
    expect(parseLimit("1")).toBe(1);
    expect(parseLimit("100")).toBe(100);
    for (const bad of ["0", "101", "-1", "1.5", "01", "abc"]) expect(parseLimit(bad)).toBeNull();
  });
});

describe("checkBotToken", () => {
  const token = "x".repeat(32);

  it("열쇠가 없거나 32자보다 짧으면 API가 꺼진다 (404)", () => {
    expect(checkBotToken(`Bearer ${token}`, undefined)).toBe("disabled");
    expect(checkBotToken("Bearer short", "short")).toBe("disabled");
    expect(checkBotToken(`Bearer ${"y".repeat(31)}`, "y".repeat(31))).toBe("disabled");
    expect(checkBotToken(null, "  ")).toBe("disabled");
  });

  it("Bearer 열쇠가 같을 때만 통과, 없거나 다르면 401", () => {
    expect(checkBotToken(`Bearer ${token}`, token)).toBe("ok");
    expect(checkBotToken(null, token)).toBe("unauthorized");
    expect(checkBotToken(token, token)).toBe("unauthorized");
    expect(checkBotToken(`Basic ${token}`, token)).toBe("unauthorized");
    expect(checkBotToken(`Bearer ${token}x`, token)).toBe("unauthorized");
    expect(checkBotToken(`Bearer ${"x".repeat(31)}`, token)).toBe("unauthorized");
    expect(checkBotToken("Bearer ", token)).toBe("unauthorized");
  });
});

describe("hasNewRelease (업데이트 소식 NEW)", () => {
  const now = new Date("2026-10-13T12:00:00Z");
  const at = (iso: string) => ({ publishedAt: new Date(iso) });

  it("최신 릴리스가 3일 안이면 NEW", () => {
    expect(hasNewRelease([at("2026-10-01T00:00:00Z"), at("2026-10-11T12:00:01Z")], now)).toBe(true);
    expect(hasNewRelease([at("2026-10-10T12:00:01Z")], now)).toBe(true);
  });

  it("3일이 지났거나 목록이 없으면 NEW 없음", () => {
    expect(hasNewRelease([at("2026-10-10T12:00:00Z")], now)).toBe(false);
    expect(hasNewRelease([], now)).toBe(false);
    expect(hasNewRelease(null, now)).toBe(false);
  });
});
