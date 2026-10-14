import { describe, expect, it } from "vitest";
import { guestbookNotificationHref, guestbookNotificationText, isGuestbookKind, notificationHref, notificationText, notificationTime, unreadBadge } from "@/lib/notifications";

describe("unreadBadge (GAME-08 헤더 숫자)", () => {
  it("없으면 null, 1~9는 그대로, 10개부터 9+", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(-1)).toBeNull();
    expect(unreadBadge(Number.NaN)).toBeNull();
    expect(unreadBadge(1)).toBe("1");
    expect(unreadBadge(9)).toBe("9");
    expect(unreadBadge(10)).toBe("9+");
    expect(unreadBadge(12)).toBe("9+");
  });
});

describe("notificationText", () => {
  it("공감·댓글은 글 제목, 답글은 제목 없이", () => {
    expect(notificationText("like", "민트", "제주 여행")).toBe("❤️ 민트님이 「제주 여행」에 공감했어요");
    expect(notificationText("comment", "민트", "제주 여행")).toBe("💬 민트님이 「제주 여행」에 댓글을 달았어요");
    expect(notificationText("reply", "민트", "제주 여행")).toBe("💬 민트님이 내 댓글에 답글을 달았어요");
  });
});

describe("notificationHref", () => {
  it("공감은 글, 댓글·답글은 #comments", () => {
    expect(notificationHref("like", "haneul", 7)).toBe("/@haneul/7");
    expect(notificationHref("comment", "haneul", 7)).toBe("/@haneul/7#comments");
    expect(notificationHref("reply", "haneul", 7)).toBe("/@haneul/7#comments");
  });
});

describe("방명록 알림 (BLOG-10)", () => {
  it("주인에게는 새 방명록 글, 작성자에게는 주인 답글. 누르면 그 블로그의 방명록", () => {
    expect(guestbookNotificationText("guestbook", "민트")).toBe("📖 민트님이 방명록에 글을 남겼어요");
    expect(guestbookNotificationText("guestbook_reply", "하늘")).toBe("📖 하늘님이 내 방명록 글에 답글을 달았어요");
    expect(guestbookNotificationHref("haneul")).toBe("/@haneul/guestbook");
    expect(isGuestbookKind("guestbook")).toBe(true);
    expect(isGuestbookKind("guestbook_reply")).toBe(true);
    expect(isGuestbookKind("comment")).toBe(false);
  });
});

describe("notificationTime", () => {
  const now = new Date("2026-10-12T03:00:00Z"); // 한국 12시
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it("공통 상대 시각 (lib/time relativeTime)", () => {
    expect(notificationTime(ago(0), now)).toBe("방금 전");
    expect(notificationTime(ago(59_999), now)).toBe("방금 전");
    expect(notificationTime(ago(60_000), now)).toBe("1분 전");
    expect(notificationTime(ago(59 * 60_000), now)).toBe("59분 전");
    expect(notificationTime(ago(60 * 60_000), now)).toBe("1시간 전");
    expect(notificationTime(ago(11 * 3_600_000 + 59 * 60_000), now)).toBe("11시간 전");
    expect(notificationTime(ago(12 * 3_600_000 + 60_000), now)).toBe("어제 23:59");
    expect(notificationTime(ago(24 * 3_600_000), now)).toBe("어제 12:00");
    // UTC로는 10월 1일 16시지만 한국은 10월 2일 1시
    expect(notificationTime(new Date("2026-10-01T16:00:00Z"), now)).toBe("2026.10.02 01:00");
  });
  it("시계가 어긋나 미래면 방금", () => {
    expect(notificationTime(new Date(now.getTime() + 5_000), now)).toBe("방금 전");
  });
});
