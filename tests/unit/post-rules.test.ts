import { describe, expect, it } from "vitest";
import { checkPostInput, POST_ERRORS, rawPostInput, type RawPostInput } from "@/lib/post-rules";

const ok: RawPostInput = { postId: "", title: "첫 글", contentHtml: "<p>안녕</p>", categoryId: "", subcategoryId: "", visibility: "public", tags: "" };
const error = (patch: Partial<RawPostInput>) => {
  const r = checkPostInput({ ...ok, ...patch });
  return r.ok ? null : r.error;
};

describe("checkPostInput", () => {
  it("올바른 입력", () => {
    const r = checkPostInput(ok);
    expect(r.ok && r.value).toMatchObject({ postId: null, title: "첫 글", isPublic: true, categoryId: null });
  });
  it("검사 순서대로 첫 오류 하나", () => {
    expect(error({ postId: "abc", title: "" })).toBe(POST_ERRORS.invalid);
    expect(error({ title: "   " })).toBe(POST_ERRORS.titleEmpty);
    expect(error({ title: "a".repeat(101) })).toBe(POST_ERRORS.titleTooLong);
    expect(error({ contentHtml: "a".repeat(200_001) })).toBe(POST_ERRORS.tooLong);
    expect(error({ categoryId: "012" })).toBe(POST_ERRORS.invalid);
    expect(error({ visibility: "friends" })).toBe(POST_ERRORS.invalid);
    expect(error({ subcategoryId: "3" })).toBe(POST_ERRORS.invalid);
  });
  it("제목은 앞뒤 공백을 지운 뒤 100자까지", () => expect(error({ title: ` ${"a".repeat(100)} ` })).toBeNull());
  it("공개 설정을 보내지 않으면 공개", () => {
    const fd = new FormData();
    fd.set("title", "t");
    expect(rawPostInput(fd).visibility).toBe("public");
  });
  it("비공개", () => {
    const r = checkPostInput({ ...ok, visibility: "private" });
    expect(r.ok && r.value.isPublic).toBe(false);
  });
});
