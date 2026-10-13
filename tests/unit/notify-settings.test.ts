import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFS,
  isActivityKind,
  NOTIFICATION_PREF_KEYS,
  NOTIFICATION_PREF_LABELS,
  notificationHref,
  notificationText,
  parseNotificationPrefs,
  prefKeyFor,
} from "@/lib/notifications";

describe("이웃 새 글 알림 (new_post)", () => {
  it("문구와 갈 곳은 그 글", () => {
    expect(notificationText("new_post", "하늘", "가을 산책")).toBe("📝 하늘님이 새 글을 올렸어요: 가을 산책");
    expect(notificationHref("new_post", "haneul", 7)).toBe("/@haneul/7");
  });
  it("활동 알림으로 다룬다", () => {
    expect(isActivityKind("new_post")).toBe(true);
    expect(isActivityKind("new_posts")).toBe(false);
  });
});

describe("prefKeyFor (알림 설정 칸)", () => {
  it("종류마다 그 칸, 방명록 답글은 방명록 칸, 문의 답변은 끌 수 없다", () => {
    expect(prefKeyFor("like")).toBe("like");
    expect(prefKeyFor("comment")).toBe("comment");
    expect(prefKeyFor("reply")).toBe("reply");
    expect(prefKeyFor("guestbook")).toBe("guestbook");
    expect(prefKeyFor("guestbook_reply")).toBe("guestbook");
    expect(prefKeyFor("new_post")).toBe("newPost");
    expect(prefKeyFor("level_up")).toBe("levelUp");
    expect(prefKeyFor("feedback_reply")).toBeNull();
  });
});

describe("parseNotificationPrefs", () => {
  const form = (on: string[]) => {
    const data = new FormData();
    for (const key of on) data.set(key, "on");
    return data;
  };
  it("체크한 칸만 켜짐", () => {
    expect(parseNotificationPrefs(form(["like", "newPost"]))).toEqual({
      like: true,
      comment: false,
      reply: false,
      guestbook: false,
      newPost: true,
      levelUp: false,
    });
  });
  it("모두 체크하면 기본값과 같고, 모르는 값은 무시한다", () => {
    const data = form([...NOTIFICATION_PREF_KEYS]);
    data.set("feedbackReply", "on");
    expect(parseNotificationPrefs(data)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    const odd = new FormData();
    odd.set("like", "true");
    expect(parseNotificationPrefs(odd).like).toBe(false);
  });
  it("모든 칸에 이름표가 있다", () => {
    for (const key of NOTIFICATION_PREF_KEYS) expect(NOTIFICATION_PREF_LABELS[key]).toBeTruthy();
  });
});
