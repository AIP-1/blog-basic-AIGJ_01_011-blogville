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
  it("표 칸의 글자도 센다", () => expect(htmlToText("<table><tbody><tr><th><p>이름</p></th><th><p>값</p></th></tr></tbody></table>")).toBe("이름\n값"));
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

describe("sanitizePostHtml 모르는 파일 카드", () => {
  it("주소를 지우고, 뒤 문단의 닫는 태그가 깨지지 않는다", () => {
    expect(sanitizePostHtml('<p>a</p><a data-file href="/files/00000000000000000000000000000000">f</a><p>b</p>')).toBe("<p>a</p><a>f</a><p>b</p>");
  });
});

describe("sanitizePostHtml 표·정렬·YouTube (개선 9)", () => {
  it("표는 칸 합치기만 남긴다", () => {
    const html = '<table style="width:1px" class="x"><colgroup><col style="min-width:25px"></colgroup><tbody><tr><th colspan="2" onclick="x"><p>머리</p></th></tr><tr><td rowspan="1"><p>칸</p></td></tr></tbody></table>';
    expect(sanitizePostHtml(html)).toBe('<table><colgroup><col /></colgroup><tbody><tr><th colspan="2"><p>머리</p></th></tr><tr><td rowspan="1"><p>칸</p></td></tr></tbody></table>');
  });
  it("정렬은 text-align 왼쪽·가운데·오른쪽만", () => {
    expect(sanitizePostHtml('<p style="text-align: center; color: red">가</p>')).toBe('<p style="text-align:center">가</p>');
    expect(sanitizePostHtml('<h2 style="text-align:right">나</h2>')).toBe('<h2 style="text-align:right">나</h2>');
    expect(sanitizePostHtml('<p style="text-align: expression(alert(1))">다</p>')).toBe("<p>다</p>");
  });
  it("YouTube 틀은 쿠키 없는 주소로 다시 쓰고, 다른 틀·div는 버린다", () => {
    const yt = sanitizePostHtml('<div data-youtube-video="" onclick="x"><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" onload="x" width="9999"></iframe></div>');
    expect(yt).toMatch(/^<div data-youtube-video(="")?><iframe /);
    expect(yt).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(yt).not.toMatch(/onload|onclick|9999|autoplay/);
    expect(sanitizePostHtml('<iframe src="https://evil.com/embed/dQw4w9WgXcQ"></iframe>')).toBe("");
    expect(sanitizePostHtml('<iframe src="javascript:alert(1)"></iframe>')).toBe("");
    expect(sanitizePostHtml("<div><p>글</p></div><p>b</p>")).toBe("<div><p>글</p></div><p>b</p>");
    expect(sanitizePostHtml('<div data-youtube-video=""><iframe src="https://evil.com/x"></iframe></div><p>c</p>')).toBe("<p>c</p>");
  });
});
