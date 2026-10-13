import { describe, expect, it } from "vitest";
import { GUESTBOOK_SECRET_PLACEHOLDER, guestbookPath, isEntryHidden } from "@/lib/guestbook-rules";

// 방명록 규칙 (BLOG-10, specs/056-guestbook)
describe("isEntryHidden", () => {
  const owner = "owner";
  const entry = (isSecret: boolean) => ({ authorId: "writer", isSecret });
  const member = (userId: string, role = "member") => ({ userId, role });

  it("공개 방명록은 누구에게나 보인다 (방문자 포함)", () => {
    expect(isEntryHidden(null, owner, entry(false))).toBe(false);
    expect(isEntryHidden(member("other"), owner, entry(false))).toBe(false);
  });

  it("비밀 방명록은 작성자·블로그 주인·관리자만 본다", () => {
    expect(isEntryHidden(member("writer"), owner, entry(true))).toBe(false);
    expect(isEntryHidden(member(owner), owner, entry(true))).toBe(false);
    expect(isEntryHidden(member("admin1", "admin"), owner, entry(true))).toBe(false);
    expect(isEntryHidden(member("other"), owner, entry(true))).toBe(true);
    expect(isEntryHidden(null, owner, entry(true))).toBe(true);
  });

  it("문구", () => {
    expect(GUESTBOOK_SECRET_PLACEHOLDER).toBe("🔒 비밀 방명록이에요");
  });
});

describe("guestbookPath", () => {
  it("1쪽은 ?page 없이, 그 뒤로는 ?page=N", () => {
    expect(guestbookPath("haneul")).toBe("/@haneul/guestbook");
    expect(guestbookPath("haneul", 1)).toBe("/@haneul/guestbook");
    expect(guestbookPath("haneul", 3)).toBe("/@haneul/guestbook?page=3");
  });
});
