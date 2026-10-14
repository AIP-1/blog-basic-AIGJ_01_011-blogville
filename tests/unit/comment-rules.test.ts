import { describe, expect, it } from "vitest";
import { canSeeSecret, checkComment, COMMENT_ERRORS, isCommentHidden, isReplyHidden } from "@/lib/comment-rules";

describe("checkComment (SOC-01)", () => {
  it("앞뒤 공백을 지우고 줄바꿈을 맞춘다", () => {
    expect(checkComment("  안녕\r\n하세요  ")).toEqual({ ok: true, content: "안녕\n하세요" });
  });
  it.each([
    ["", COMMENT_ERRORS.empty],
    [" \n\t ", COMMENT_ERRORS.empty],
    ["가".repeat(1001), COMMENT_ERRORS.tooLong],
  ])("%j → 오류", (raw, error) => expect(checkComment(raw)).toEqual({ ok: false, error }));
  it("1000자, 이모지는 1자", () => {
    expect(checkComment("가".repeat(1000)).ok).toBe(true);
    expect(checkComment("😀".repeat(1000)).ok).toBe(true);
  });
});

describe("비밀 댓글 (specs/055-comment-edit-secret)", () => {
  const owner = { userId: "owner", role: "user" };
  const admin = { userId: "admin", role: "admin" };
  const author = { userId: "author", role: "user" };
  const replier = { userId: "replier", role: "user" };
  const other = { userId: "other", role: "user" };

  it("canSeeSecret: 관리자·블로그 주인·작성자만, 방문자와 탈퇴한 작성자(null)는 아니다", () => {
    expect(canSeeSecret(admin, "owner", ["author"])).toBe(true);
    expect(canSeeSecret(owner, "owner", ["author"])).toBe(true);
    expect(canSeeSecret(author, "owner", ["author"])).toBe(true);
    expect(canSeeSecret(other, "owner", ["author"])).toBe(false);
    expect(canSeeSecret(null, "owner", ["author"])).toBe(false);
    expect(canSeeSecret(other, "owner", [null])).toBe(false);
  });

  it("isCommentHidden: 비밀이 아니면 누구에게나 보인다", () => {
    expect(isCommentHidden(null, "owner", { authorId: "author", isSecret: false })).toBe(false);
    expect(isCommentHidden(null, "owner", { authorId: "author", isSecret: true })).toBe(true);
    expect(isCommentHidden(other, "owner", { authorId: "author", isSecret: true })).toBe(true);
    expect(isCommentHidden(author, "owner", { authorId: "author", isSecret: true })).toBe(false);
    expect(isCommentHidden(owner, "owner", { authorId: "author", isSecret: true })).toBe(false);
  });

  it("isReplyHidden: 답글이나 원댓글이 비밀이면 답글 작성자·원댓글 작성자·주인·관리자만", () => {
    const parent = { authorId: "author", isSecret: true };
    const reply = { authorId: "replier", isSecret: false };
    for (const v of [admin, owner, author, replier]) expect(isReplyHidden(v, "owner", reply, parent)).toBe(false);
    expect(isReplyHidden(other, "owner", reply, parent)).toBe(true);
    expect(isReplyHidden(null, "owner", reply, parent)).toBe(true);

    const secretReply = { authorId: "replier", isSecret: true };
    const openParent = { authorId: "author", isSecret: false };
    for (const v of [admin, owner, author, replier]) expect(isReplyHidden(v, "owner", secretReply, openParent)).toBe(false);
    expect(isReplyHidden(other, "owner", secretReply, openParent)).toBe(true);

    expect(isReplyHidden(null, "owner", reply, openParent)).toBe(false);
  });
});
