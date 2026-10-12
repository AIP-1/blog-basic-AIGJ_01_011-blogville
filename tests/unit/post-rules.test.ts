import { describe, expect, it } from "vitest";
import { checkPostInput, linkHref, POST_ERRORS, PUBLISH_NOTICE_MS, rawPostInput, showsPublishNotice, type RawPostInput } from "@/lib/post-rules";

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

describe("linkHref (링크 창)", () => {
  it("비우거나 https://만 남기면 링크 풀기", () => {
    for (const v of ["", "  ", "https://", "http://", " HTTPS:// "]) expect(linkHref(v)).toBe("");
  });
  it("http·https·mailto와 /로 시작하는 주소는 그대로", () => {
    for (const v of ["https://example.com/blog", "http://a.kr", "mailto:me@example.com", "/@demo/12", "HTTPS://A.KR"]) expect(linkHref(v)).toBe(v.trim());
  });
  it("scheme 없이 넣은 주소에는 https://를 붙인다", () => {
    expect(linkHref("naver.com")).toBe("https://naver.com");
    expect(linkHref(" blog.naver.com/x?y=1 ")).toBe("https://blog.naver.com/x?y=1");
    expect(linkHref("naver.com:8080/a")).toBe("https://naver.com:8080/a");
    expect(linkHref("//cdn.example.com/a")).toBe("https://cdn.example.com/a");
  });
  it("저장하면 사라지거나 엉뚱한 곳으로 가는 주소는 거부", () => {
    for (const v of ["javascript:alert(1)", "tel:01012345678", "ftp://a.kr", "data:text/html,x", "hello", "naver com", "#top"]) expect(linkHref(v)).toBeNull();
  });
});

describe("showsPublishNotice (발행 안내)", () => {
  const now = Date.parse("2026-10-12T04:00:00Z");
  const ago = (ms: number) => new Date(now - ms);
  it("주인이고 만든 지 10분 안이면 보인다", () => {
    expect(showsPublishNotice(true, ago(0), now)).toBe(true);
    expect(showsPublishNotice(true, ago(PUBLISH_NOTICE_MS), now)).toBe(true);
  });
  it("10분이 지났거나 주인이 아니면 없다", () => {
    expect(showsPublishNotice(true, ago(PUBLISH_NOTICE_MS + 1), now)).toBe(false);
    expect(showsPublishNotice(false, ago(0), now)).toBe(false);
  });
  it("앞날짜로 넣은 글(시계 차이 1분 넘게)은 없다", () => {
    expect(showsPublishNotice(true, ago(-30_000), now)).toBe(true);
    expect(showsPublishNotice(true, ago(-61_000), now)).toBe(false);
  });
});
