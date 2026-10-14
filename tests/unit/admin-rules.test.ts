import { describe, expect, it } from "vitest";
import {
  ADMIN_ERRORS,
  BANNED_ERRORS,
  bannedWordError,
  decodeNotice,
  findBannedWord,
  isPermanent,
  isSuspended,
  lastDaysKST,
  likePattern,
  memberActionError,
  NOTICE_ERRORS,
  noticeDismissKey,
  parseAuditAction,
  parseBannedWords,
  parseContentRefs,
  parseContentTab,
  parseNotice,
  parseReason,
  parseStatRange,
  parseSuspendDays,
  PERMANENT_UNTIL,
  roleChangeError,
  snippet,
  suspendedMessage,
  suspendUntil,
} from "@/lib/admin-rules";

// 관리자 보강 규칙 (ADM-01~06, specs/058-admin-tools)

describe("ADM-01 정지 기간·사유·문구", () => {
  it("정지 기간은 1·7·30일과 영구(0)만", () => {
    expect(["1", "7", "30", "0"].map(parseSuspendDays)).toEqual([1, 7, 30, 0]);
    for (const bad of ["3", "-1", "07", "1.5", "", "365", null, 7]) expect(parseSuspendDays(bad)).toBeNull();
  });

  it("정지 끝 시각: N일 뒤, 영구는 9999-12-31", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    expect(suspendUntil(7, now).toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(suspendUntil(0, now)).toBe(PERMANENT_UNTIL);
    expect(isPermanent(suspendUntil(0, now))).toBe(true);
    expect(isPermanent(suspendUntil(30, now))).toBe(false);
  });

  it("정지 중인지: 끝 시각이 지금보다 뒤일 때만", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    expect(isSuspended(null, now)).toBe(false);
    expect(isSuspended(new Date("2026-10-12T23:59:59Z"), now)).toBe(false);
    expect(isSuspended(new Date("2026-10-13T00:00:01Z"), now)).toBe(true);
    expect(isSuspended(PERMANENT_UNTIL, now)).toBe(true);
  });

  it("사유는 공백을 줄여 1~200자", () => {
    expect(parseReason("  도배   광고 ")).toBe("도배 광고");
    expect(parseReason("   ")).toBeNull();
    expect(parseReason("가".repeat(201))).toBeNull();
    expect(parseReason("가".repeat(200))).toHaveLength(200);
    expect(parseReason(1)).toBeNull();
  });

  it("로그인 화면 문구: 한국 시간 날짜와 사유, 영구 정지", () => {
    expect(suspendedMessage(new Date("2026-10-20T06:00:00Z"), "도배")).toBe("이용이 정지된 계정이에요 (2026.10.20 15:00까지, 사유: 도배)");
    expect(suspendedMessage(PERMANENT_UNTIL, "광고")).toBe("이용이 정지된 계정이에요 (영구 정지, 사유: 광고)");
    expect(suspendedMessage(PERMANENT_UNTIL, null)).toBe("이용이 정지된 계정이에요 (영구 정지)");
  });
});

describe("ADM-01 역할 변경·강제 탈퇴 막기", () => {
  const base = { actorId: "a", targetId: "b", targetRole: "admin", newRole: "user" as const, adminCount: 2 };
  it("내 역할은 바꿀 수 없다", () => {
    expect(roleChangeError({ ...base, targetId: "a" })).toBe(ADMIN_ERRORS.self);
    expect(roleChangeError({ ...base, targetId: "a", newRole: "admin" })).toBe(ADMIN_ERRORS.self);
  });
  it("마지막 관리자는 해제할 수 없다", () => {
    expect(roleChangeError({ ...base, adminCount: 1 })).toBe(ADMIN_ERRORS.lastAdmin);
    expect(roleChangeError(base)).toBeNull();
  });
  it("회원을 관리자로 지정하는 것은 막지 않는다", () => {
    expect(roleChangeError({ ...base, targetRole: "user", newRole: "admin", adminCount: 1 })).toBeNull();
  });
  it("정지·강제 탈퇴: 나 자신과 다른 관리자는 안 된다", () => {
    expect(memberActionError({ actorId: "a", targetId: "a", targetRole: "admin" })).toBe(ADMIN_ERRORS.self);
    expect(memberActionError({ actorId: "a", targetId: "b", targetRole: "admin" })).toBe(ADMIN_ERRORS.adminTarget);
    expect(memberActionError({ actorId: "a", targetId: "b", targetRole: "user" })).toBeNull();
  });
});

describe("ADM-02 콘텐츠 선택 삭제 값", () => {
  it("탭은 posts·comments·guestbook, 나머지는 posts", () => {
    expect(parseContentTab("comments")).toBe("comments");
    expect(parseContentTab("guestbook")).toBe("guestbook");
    expect(parseContentTab("users")).toBe("posts");
    expect(parseContentTab(undefined)).toBe("posts");
  });
  it("탭에 맞는 종류만, 중복은 한 번", () => {
    expect(parseContentRefs("comments", ["comment:1", "reply:2", "comment:1"])).toEqual([
      { kind: "comment", id: 1 },
      { kind: "reply", id: 2 },
    ]);
    expect(parseContentRefs("posts", ["post:3"])).toEqual([{ kind: "post", id: 3 }]);
    expect(parseContentRefs("guestbook", ["guestbook:9"])).toEqual([{ kind: "guestbook", id: 9 }]);
  });
  it("다른 탭 종류·이상한 ID·0개·50개 초과는 거절", () => {
    expect(parseContentRefs("posts", ["comment:1"])).toBeNull();
    expect(parseContentRefs("comments", ["comment:0"])).toBeNull();
    expect(parseContentRefs("comments", ["comment:01"])).toBeNull();
    expect(parseContentRefs("comments", ["comment:9999999999"])).toBeNull();
    expect(parseContentRefs("comments", [new File([], "x")])).toBeNull();
    expect(parseContentRefs("comments", [])).toBeNull();
    expect(parseContentRefs("posts", Array.from({ length: 51 }, (_, i) => `post:${i + 1}`))).toBeNull();
  });
  it("요약은 공백을 줄이고 길면 …", () => {
    expect(snippet(" 가\n\n나  다 ")).toBe("가 나 다");
    expect(snippet("가".repeat(70))).toBe(`${"가".repeat(60)}…`);
  });
});

describe("ADM-04 공지 띠", () => {
  it("문구 1~200자, 공백을 줄인다, 켜기는 체크 상자 on", () => {
    expect(parseNotice({ text: "  점검   안내 ", link: "", enabled: "on" })).toEqual({ ok: true, value: { text: "점검 안내", link: null, enabled: true } });
    expect(parseNotice({ text: "점검", link: null, enabled: null })).toEqual({ ok: true, value: { text: "점검", link: null, enabled: false } });
    expect(parseNotice({ text: " ", link: "", enabled: "on" })).toEqual({ ok: false, error: NOTICE_ERRORS.text });
    expect(parseNotice({ text: "가".repeat(201), link: "", enabled: "on" })).toEqual({ ok: false, error: NOTICE_ERRORS.text });
  });
  it("링크는 이 사이트 안 주소만", () => {
    expect(parseNotice({ text: "a", link: "/@notice/12", enabled: "on" })).toMatchObject({ ok: true, value: { link: "/@notice/12" } });
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "javascript:alert(1)", `/${"a".repeat(200)}`]) {
      expect(parseNotice({ text: "a", link: bad, enabled: "on" })).toEqual({ ok: false, error: NOTICE_ERRORS.link });
    }
  });
  it("저장된 값 읽기: 망가진 JSON·모양이 다르면 null, 밖 주소 링크는 버린다", () => {
    expect(decodeNotice(JSON.stringify({ text: "a", link: "/x", enabled: true }))).toEqual({ text: "a", link: "/x", enabled: true });
    expect(decodeNotice(JSON.stringify({ text: "a", link: "//evil.com", enabled: true }))).toEqual({ text: "a", link: null, enabled: true });
    expect(decodeNotice("{")).toBeNull();
    expect(decodeNotice(JSON.stringify({ text: "", link: null, enabled: true }))).toBeNull();
    expect(decodeNotice(null)).toBeNull();
  });
  it("닫기 기억 키는 저장 시각마다 다르다", () => {
    expect(noticeDismissKey(new Date(1000))).toBe("bv-notice-dismissed:1000");
    expect(noticeDismissKey(new Date(1000))).not.toBe(noticeDismissKey(new Date(2000)));
  });
});

describe("ADM-05 금지어", () => {
  it("한 줄에 하나, 빈 줄·대소문자 중복은 뺀다", () => {
    expect(parseBannedWords(" 바보 \r\n\nSPAM\nspam\n")).toEqual({ ok: true, words: ["바보", "SPAM"] });
    expect(parseBannedWords("")).toEqual({ ok: true, words: [] });
    expect(parseBannedWords(null)).toEqual({ ok: true, words: [] });
  });
  it("30자 넘는 줄, 200개 넘으면 거절", () => {
    expect(parseBannedWords("가".repeat(31))).toMatchObject({ ok: false });
    expect(parseBannedWords("가".repeat(30))).toMatchObject({ ok: true });
    expect(parseBannedWords(Array.from({ length: 201 }, (_, i) => `w${i}`).join("\n"))).toEqual({ ok: false, error: BANNED_ERRORS.tooMany });
    expect(parseBannedWords(Array.from({ length: 200 }, (_, i) => `w${i}`).join("\n"))).toMatchObject({ ok: true });
  });
  it("대소문자 없이 글자 안에 들어 있으면 찾는다", () => {
    expect(findBannedWord("Buy CHEAP pills", ["cheap"])).toBe("cheap");
    expect(findBannedWord("너는바보야", ["바보"])).toBe("바보");
    expect(findBannedWord("좋은 글이에요", ["바보", "spam"])).toBeNull();
    expect(findBannedWord("", ["바보"])).toBeNull();
    expect(findBannedWord("아무거나", [])).toBeNull();
  });
  it("여러 칸 중 하나라도 있으면 문구", () => {
    expect(bannedWordError(["spam"], "제목", "본문 SPAM")).toBe("사용할 수 없는 말이 들어 있어요: spam");
    expect(bannedWordError(["spam"], "제목", "본문")).toBeNull();
  });
});

describe("ADM-03·06 통계·기록 값", () => {
  it("기간은 7 또는 30", () => {
    expect(parseStatRange("30")).toBe(30);
    expect(parseStatRange("7")).toBe(7);
    expect(parseStatRange("99")).toBe(7);
  });
  it("최근 N일 한국 날짜, 오래된 날부터", () => {
    // 한국 시간 2026-10-13 08:00
    const days = lastDaysKST(7, new Date("2026-10-12T23:00:00Z"));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-10-07");
    expect(days[6]).toBe("2026-10-13");
  });
  it("기록 종류는 정해진 것만", () => {
    expect(parseAuditAction("suspend")).toBe("suspend");
    expect(parseAuditAction("toString")).toBeNull();
    expect(parseAuditAction("drop")).toBeNull();
  });
  it("LIKE 특수 문자는 글자 그대로", () => {
    expect(likePattern("a%_\\")).toBe("%a\\%\\_\\\\%");
  });
});
