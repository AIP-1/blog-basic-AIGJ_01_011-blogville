import { describe, expect, it } from "vitest";
import { checkPostInput, parseTags, POST_ERRORS } from "@/lib/post-rules";

describe("parseTags (POST-04)", () => {
  it.each([
    ["", []],
    ["git, #회고, Git", ["git", "회고"]],
    ["git 회고", ["git 회고"]],
    ["  a   b  ,c", ["a b", "c"]],
    ["c#", ["c"]],
    ["a\nb\r\nc", ["a", "b", "c"]],
    [",,#,  ,", []],
    ["가".repeat(20) + ",나", ["가".repeat(20), "나"]],
    ["가".repeat(21) + ",나", ["나"]],
    ["😀".repeat(10) + "," + "😀".repeat(11), ["😀".repeat(10)]],
  ])("%j → %j", (raw, expected) => expect(parseTags(raw)).toEqual(expected));

  it("11개면 앞 10개, 중복은 세지 않는다", () => {
    const raw = ["a", "A", ...Array.from({ length: 11 }, (_, i) => `t${i}`)].join(",");
    expect(parseTags(raw)).toEqual(["a", ...Array.from({ length: 9 }, (_, i) => `t${i}`)]);
  });
});

describe("checkPostInput 태그", () => {
  const base = { postId: "", title: "글", contentHtml: "<p>x</p>", categoryId: "", subcategoryId: "", visibility: "public" };
  it("300자까지", () => {
    const r = checkPostInput({ ...base, tags: "a".repeat(300) });
    expect(r.ok && r.value.tags).toEqual([]);
  });
  it("300자를 넘기면 문구", () => {
    expect(checkPostInput({ ...base, tags: "a".repeat(301) })).toEqual({ ok: false, error: POST_ERRORS.tagsTooLong });
  });
});
