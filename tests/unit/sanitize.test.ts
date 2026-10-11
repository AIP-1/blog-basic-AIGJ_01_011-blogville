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

describe("sanitizePostHtml 첨부 (002 FR-006)", () => {
  const IMG = "a".repeat(32);
  const FILE = "b".repeat(32);
  const known = new Map([
    [IMG, { kind: "image" as const, name: "사진.png", size: 100 }],
    [FILE, { kind: "file" as const, name: "보고서 최종본.pdf", size: 1258291 }],
  ]);

  it("붙일 수 있는 사진만 남기고 alt를 비운다", () => {
    expect(sanitizePostHtml(`<img src="/files/${IMG}" alt="x" onerror="alert(1)">`, known)).toBe(`<img src="/files/${IMG}" alt="" />`);
  });
  it.each([
    ["다른 사이트", `<img src="https://evil.example/x.png">`],
    ["data:", `<img src="data:image/png;base64,AAAA">`],
    ["javascript:", `<img src="javascript:alert(1)">`],
    ["모르는 키", `<img src="/files/${"c".repeat(32)}">`],
    ["파일을 사진으로", `<img src="/files/${FILE}">`],
    ["known 없음", `<img src="/files/${IMG}">`],
  ])("%s 사진은 뺀다", (label, html) => {
    expect(sanitizePostHtml(`<p>글</p>${html}`, label === "known 없음" ? new Map() : known)).toBe("<p>글</p>");
  });
  it("파일 카드는 DB 값으로 다시 쓴다", () => {
    const html = `<a href="/files/${FILE}" data-file="" data-name="가짜.exe" data-size="1" data-size-label="1B" data-ext="exe" target="_blank">글자</a>`;
    expect(sanitizePostHtml(html, known)).toBe(
      `<a href="/files/${FILE}" data-file data-name="보고서 최종본.pdf" data-size="1258291" data-size-label="1.2MB" data-ext="pdf" aria-label="보고서 최종본.pdf 내려받기 (1.2MB)">글자</a>`,
    );
  });
  it("모르는 키·사진 키의 파일 카드는 뺀다", () => {
    expect(sanitizePostHtml(`<a href="/files/${"c".repeat(32)}" data-file></a>`, known)).toBe("");
    expect(sanitizePostHtml(`<a href="/files/${IMG}" data-file></a>`, known)).toBe("");
  });
  it("사진·카드는 글자 수에 들어가지 않는다", () => {
    expect(htmlToText(sanitizePostHtml(`<img src="/files/${IMG}"><a href="/files/${FILE}" data-file=""></a>`, known))).toBe("");
  });
});
