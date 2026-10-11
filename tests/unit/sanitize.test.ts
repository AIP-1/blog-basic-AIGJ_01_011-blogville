import { describe, expect, it } from "vitest";
import { htmlToText, sanitizePostHtml } from "@/lib/sanitize";

describe("sanitizePostHtml (NF-03)", () => {
  it.each([
    ["<p>a</p><script>alert(1)</script>", "<p>a</p>"],
    ['<p onclick="x()">a</p>', "<p>a</p>"],
    ['<img src="x" onerror="alert(1)">', ""],
    ['<iframe src="https://evil"></iframe><p>a</p>', "<p>a</p>"],
    ["<style>p{}</style><p>a</p>", "<p>a</p>"],
  ])("%s → %s", (input, expected) => expect(sanitizePostHtml(input)).toBe(expected));

  it("javascript: 링크는 주소를 지운다", () => {
    expect(sanitizePostHtml('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
  });
  it("링크는 새 탭 + rel", () => {
    expect(sanitizePostHtml('<a href="https://a.com">x</a>')).toBe(
      '<a href="https://a.com" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
  });
  it("허용 태그는 남긴다", () => {
    const html = "<h2>t</h2><h3>s</h3><p><strong>b</strong><em>i</em><code>c</code></p><blockquote><p>q</p></blockquote><ul><li>l</li></ul><ol><li>o</li></ol><pre><code>x</code></pre><hr>";
    expect(sanitizePostHtml(html)).toBe(html.replace("<hr>", "<hr />"));
  });
  it("h1은 없앤다 (제목은 H2·H3만)", () => expect(sanitizePostHtml("<h1>x</h1>")).toBe("x"));
});

describe("htmlToText", () => {
  it("태그를 빼고 블록을 줄로", () => expect(htmlToText("<p>a &amp; b</p><p>c</p>")).toBe("a & b\nc"));
  it("빈 문단·구분선만 있으면 빈 글자", () => expect(htmlToText("<p></p><hr />")).toBe(""));
});
