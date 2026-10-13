import { describe, expect, it } from "vitest";
import { isEmptyDraft, parseDraft, savedLabel } from "@/lib/draft";

describe("parseDraft", () => {
  it("저장한 값을 그대로 읽는다", () => {
    const d = { title: "제목", categoryId: 3, subcategoryId: 7, visibility: "private", contentHtml: "<p><strong>굵게</strong></p>", tags: "git, 회고", savedAt: 1 };
    expect(parseDraft(JSON.stringify(d))).toEqual(d);
  });
  it("형식이 틀린 칸은 버린다", () => {
    const d = parseDraft(JSON.stringify({ title: 5, categoryId: "3", subcategoryId: -1, visibility: "secret", contentHtml: "<p>x</p>", tags: ["a"], savedAt: "x" }));
    expect(d).toEqual({ title: "", categoryId: null, subcategoryId: null, visibility: "public", contentHtml: "<p>x</p>", tags: "", savedAt: 0 });
    expect(parseDraft(JSON.stringify({ title: "t", categoryId: 1.5 }))?.categoryId).toBeNull();
  });
  it("JSON이 아니거나 비어 있으면 없다", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("{")).toBeNull();
    expect(parseDraft("[]")).toEqual(null);
    expect(parseDraft("null")).toBeNull();
    expect(parseDraft(JSON.stringify({ title: "  ", contentHtml: "" }))).toBeNull();
  });
});

describe("isEmptyDraft·savedLabel", () => {
  it("제목 공백과 빈 본문은 비어 있음", () => {
    expect(isEmptyDraft("  ", "")).toBe(true);
    expect(isEmptyDraft("a", "")).toBe(false);
    expect(isEmptyDraft("", "b")).toBe(false);
  });
  it("한국 시간 24시간제", () => {
    expect(savedLabel(Date.UTC(2026, 9, 11, 5, 5))).toBe("임시 저장됨 14:05");
    expect(savedLabel(Date.UTC(2026, 9, 11, 15, 0))).toBe("임시 저장됨 00:00");
  });
});
