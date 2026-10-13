import { describe, expect, it } from "vitest";
import { renderPostHtml } from "@/lib/post-render";
import { addHeadingIds, decodeEntities, headingSlug, readingMinutes } from "@/lib/reader";
import { sanitizePostHtml } from "@/lib/sanitize";

describe("readingMinutes (약 N분 읽기)", () => {
  it.each([
    ["", 1],
    ["짧은 글", 1],
    ["가".repeat(500), 1],
    ["가".repeat(1250), 3],
    ["가".repeat(5000), 10],
  ])("%#: %s자 → %i분", (text, minutes) => expect(readingMinutes(text)).toBe(minutes));

  it("공백·줄바꿈은 세지 않는다", () => {
    expect(readingMinutes(`${"가 ".repeat(1000)}\n\n`)).toBe(2);
  });
});

describe("headingSlug (소제목 id)", () => {
  it.each([
    ["시작하며", "시작하며"],
    ["1. 설치 방법", "1-설치-방법"],
    ["Hello, World!", "hello-world"],
    ["  앞뒤   공백  ", "앞뒤-공백"],
    ["<script>\"'", "script"],
    ["!!!", "section"],
    ["", "section"],
  ])("%s → %s", (text, slug) => expect(headingSlug(text)).toBe(slug));

  it("속성에 넣어도 안전한 글자만 남긴다", () => {
    expect(headingSlug(`a"b'c<d>e&f g`)).toMatch(/^[\p{L}\p{N}_-]+$/u);
  });
});

describe("addHeadingIds (목차)", () => {
  it("h2·h3에 id를 달고 목차를 만든다, 같은 제목은 -2, -3", () => {
    const { html, toc } = addHeadingIds("<h2>소개</h2><p>a</p><h3>소개</h3><h2>소개</h2><h3><strong>굵은</strong> &amp; 제목</h3>");
    expect(html).toBe('<h2 id="소개">소개</h2><p>a</p><h3 id="소개-2">소개</h3><h2 id="소개-3">소개</h2><h3 id="굵은-제목"><strong>굵은</strong> &amp; 제목</h3>');
    expect(toc).toEqual([
      { id: "소개", text: "소개", level: 2 },
      { id: "소개-2", text: "소개", level: 3 },
      { id: "소개-3", text: "소개", level: 2 },
      { id: "굵은-제목", text: "굵은 & 제목", level: 3 },
    ]);
  });

  it("글 화면에 이미 있는 id(comments)와 겹치지 않는다", () => {
    expect(addHeadingIds("<h2>Comments</h2>").toc[0].id).toBe("comments-2");
  });

  it("빈 소제목은 목차에 넣지 않는다", () => {
    expect(addHeadingIds("<h2></h2><h2>a</h2>").toc).toHaveLength(1);
  });

  it("글자 참조를 푼다", () => {
    expect(decodeEntities("&lt;a&gt; &amp; &#39;b&#x27; &quot;")).toBe(`<a> & 'b' "`);
  });
});

describe("renderPostHtml (보여 줄 때 바꾸기)", () => {
  it("코드 블록을 색칠하고 [복사] 버튼을 붙인다", () => {
    const saved = sanitizePostHtml("<pre><code>const a = 1;\nfunction f(x) { return x + 1; }</code></pre>");
    const { html } = renderPostHtml(saved);
    expect(html).toContain('<div class="code-block"><pre><code class="hljs">');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
    expect(html).toContain('<button type="button" class="code-copy" data-copy-code>복사</button></div>');
  });

  it("짧아서 언어를 모르는 코드는 색칠하지 않는다", () => {
    expect(renderPostHtml("<pre><code>코드</code></pre>").html).toContain('<code class="hljs">코드</code>');
  });

  it.each([
    "<pre><code>&lt;script&gt;alert(1)&lt;/script&gt;</code></pre>",
    '<pre><code>&lt;img src=x onerror="alert(1)"&gt;</code></pre>',
    // 정화를 거치지 않은 값이 들어와도 다시 거른다
    '<pre><code><img src=x onerror="alert(1)"><script>alert(1)</script></code></pre>',
    '<h2 onclick="x()">제목</h2><p><span class="evil" style="x">a</span></p><script>alert(1)</script>',
    '<pre><code class="hljs"><span class="hljs-keyword" onclick="x()">a</span></code></pre>',
  ])("안전: %s", (input) => {
    const { html } = renderPostHtml(input);
    expect(html).not.toMatch(/<script|<img|onerror=|onclick=|style=|class="evil"/i);
  });

  it("코드 속 HTML 글자는 글자로 보인다", () => {
    const { html } = renderPostHtml('<pre><code>&lt;div class="a"&gt;hi&lt;/div&gt;</code></pre>');
    expect(html).not.toContain("<div class=\"a\"");
    expect(html).toContain("&lt;");
  });

  it("소제목 id·목차, 사진·파일 카드·링크는 그대로", () => {
    const saved =
      '<h2>하나</h2><h3>둘</h3><h2>셋</h2><p><img src="/files/abc.png" alt="" /></p>' +
      '<p><a href="https://a.com" target="_blank" rel="noopener noreferrer nofollow">x</a></p>';
    const { html, toc } = renderPostHtml(saved);
    expect(toc.map((t) => t.id)).toEqual(["하나", "둘", "셋"]);
    expect(html).toContain('<h2 id="하나">하나</h2>');
    expect(html).toContain('<img src="/files/abc.png" alt="" />');
    expect(html).toContain('<a href="https://a.com" target="_blank" rel="noopener noreferrer nofollow">x</a>');
  });
  it("표·정렬·YouTube 틀은 글 화면에서도 남는다 (개선 9)", () => {
    const yt = '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" width="640" height="360"></iframe></div>';
    const saved =
      '<h2 style="text-align:center">가운데</h2><p style="text-align:right">오른쪽</p>' +
      '<table><tbody><tr><th colspan="2"><p>머리</p></th></tr></tbody></table>' + yt;
    const { html, toc } = renderPostHtml(saved);
    expect(toc.map((t) => t.id)).toEqual(["가운데"]);
    expect(html).toContain('<h2 id="가운데" style="text-align:center">가운데</h2>');
    expect(html).toContain('<p style="text-align:right">오른쪽</p>');
    expect(html).toContain('<th colspan="2"><p>머리</p></th>');
    expect(html).toContain('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"');
    expect(renderPostHtml('<iframe src="https://evil.com/x"></iframe><p>a</p>').html).toBe("<p>a</p>");
  });
});
