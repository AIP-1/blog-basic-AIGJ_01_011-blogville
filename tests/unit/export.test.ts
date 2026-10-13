import { describe, expect, it } from "vitest";
import {
  attachmentPath,
  EXPORT_INTERVAL_MS,
  exportFileName,
  exportWaitMs,
  htmlToMarkdown,
  postBaseName,
  renderPostHtml,
  renderPostMarkdown,
  rewriteFileUrls,
  slugifyTitle,
  visibilityLabel,
  waitMinutes,
} from "@/lib/export";

const K1 = "a".repeat(32);
const K2 = "b".repeat(32);

describe("파일 이름", () => {
  it("zip 이름은 한국 날짜", () => {
    // 한국 시간 2026-10-14 00:30
    expect(exportFileName("my_blog", new Date("2026-10-13T15:30:00Z"))).toBe("blogville-my_blog-20261014.zip");
  });
  it.each([
    ["첫 번째 글!", "첫-번째-글"],
    ["Hello, World 2026", "hello-world-2026"],
    ["  ../../etc/passwd  ", "etc-passwd"],
    ["🎉🎉", "post"],
    ["가".repeat(60), "가".repeat(40)],
  ])("%s → %s", (title, slug) => expect(slugifyTitle(title)).toBe(slug));
  it("글 파일은 posts/번호-제목", () => expect(postBaseName(12, "새 글")).toBe("posts/12-새-글"));
  it("첨부는 files/키.확장자 (확장자가 없으면 형식으로)", () => {
    expect(attachmentPath({ key: K1, name: "사진.PNG", mime: "image/png" })).toBe(`files/${K1}.png`);
    expect(attachmentPath({ key: K1, name: "noext", mime: "image/jpeg" })).toBe(`files/${K1}.jpg`);
    expect(attachmentPath({ key: K1, name: "noext", mime: "application/x" })).toBe(`files/${K1}.bin`);
  });
});

describe("rewriteFileUrls", () => {
  const paths = new Map([[K1, `files/${K1}.png`]]);
  it("아는 첨부만 상대 경로로", () => {
    const html = `<p><img src="/files/${K1}" alt="" /><a href="/files/${K2}" data-file="">x</a></p>`;
    expect(rewriteFileUrls(html, paths)).toBe(`<p><img src="../files/${K1}.png" alt="" /><a href="/files/${K2}" data-file="">x</a></p>`);
  });
  it("앞붙임을 바꿀 수 있다", () => expect(rewriteFileUrls(`<img src="/files/${K1}">`, paths, "")).toBe(`<img src="files/${K1}.png">`));
});

describe("htmlToMarkdown (저장 허용 태그)", () => {
  it.each([
    ["<p>안녕 <strong>굵게</strong> <em>기울임</em> <s>취소</s> <u>밑줄</u></p>", "안녕 **굵게** *기울임* ~~취소~~ <u>밑줄</u>\n"],
    ["<h2>소제목</h2><h3>작은 제목</h3>", "## 소제목\n\n### 작은 제목\n"],
    ["<p>a<br />b</p>", "a  \nb\n"],
    ["<p><code>x &lt; y</code></p>", "`x < y`\n"],
    ["<pre><code>const a = 1;\nif (a &gt; 0) {}\n</code></pre>", "```\nconst a = 1;\nif (a > 0) {}\n```\n"],
    ["<blockquote><p>인용</p><p>둘째</p></blockquote>", "> 인용\n>\n> 둘째\n"],
    ["<ul><li><p>하나</p></li><li><p>둘</p><ul><li><p>안</p></li></ul></li></ul>", "- 하나\n- 둘\n  - 안\n"],
    ["<ol><li><p>첫째</p></li><li><p>둘째</p></li></ol>", "1. 첫째\n2. 둘째\n"],
    ["<p>위</p><hr /><p>아래</p>", "위\n\n---\n\n아래\n"],
    ['<p><a href="https://a.com" target="_blank" rel="noopener">링크</a></p>', "[링크](https://a.com)\n"],
    ['<p><img src="../files/k.png" alt="" /></p>', "![](../files/k.png)\n"],
    ["<p>*별* _밑_ [괄호] &amp; &lt;b&gt;</p>", "\\*별\\* \\_밑\\_ \\[괄호\\] & \\<b\\>\n"],
    ["<p># 제목 아님</p>", "\\# 제목 아님\n"],
    ["<p></p>", ""],
  ])("%s", (html, md) => expect(htmlToMarkdown(html)).toBe(md));

  it("파일 카드는 이름·크기 링크로", () => {
    const html = '<p><a href="../files/k.pdf" data-file="" data-name="보고서.pdf" data-size="2048" data-size-label="2KB" data-ext="pdf">보고서.pdf</a></p>';
    expect(htmlToMarkdown(html)).toBe("[📎 보고서.pdf (2KB)](../files/k.pdf)\n");
  });
});

describe("글 파일", () => {
  const post = {
    id: 3,
    title: "<제목> & \"따옴표\"",
    contentHtml: `<p>본문</p><p><img src="/files/${K1}" alt="" /></p>`,
    createdAt: new Date("2026-10-13T01:00:00Z"),
    updatedAt: new Date("2026-10-13T01:00:00Z"),
    category: "일상 > 여행",
    series: null,
    tags: ["가을", "산책"],
    visibility: "비공개",
  };
  const paths = new Map([[K1, `files/${K1}.png`]]);
  it("HTML은 제목을 이스케이프하고 사진을 상대 경로로", () => {
    const html = renderPostHtml(post, "내 블로그", paths);
    expect(html).toContain("<h1>&lt;제목&gt; &amp; &quot;따옴표&quot;</h1>");
    expect(html).toContain(`src="../files/${K1}.png"`);
    expect(html).toContain("2026-10-13 10:00");
    expect(html).toContain("일상 &gt; 여행");
    expect(html).toContain("#가을");
    expect(html).toContain("비공개");
  });
  it("Markdown은 앞머리에 정보", () => {
    const md = renderPostMarkdown(post, paths);
    expect(md).toMatch(/^---\ntitle: "<제목> & \\"따옴표\\""\n/);
    expect(md).toContain('tags: ["가을", "산책"]');
    expect(md).toContain('visibility: "비공개"');
    expect(md).toContain(`![](../files/${K1}.png)`);
  });
  it("공개 범위", () => {
    expect(visibilityLabel({ isPublic: true, publishAt: null, blindedAt: null })).toBe("공개");
    expect(visibilityLabel({ isPublic: false, publishAt: null, blindedAt: null })).toBe("비공개");
    expect(visibilityLabel({ isPublic: false, publishAt: new Date("2026-10-20T00:00:00Z"), blindedAt: null })).toContain("예약 발행 (2026-10-20 09:00");
  });
});

describe("10분에 한 번", () => {
  it("처음이면 기다리지 않는다", () => expect(exportWaitMs(undefined, 1000)).toBe(0));
  it("10분 안이면 남은 시간", () => expect(exportWaitMs(0, 60_000)).toBe(EXPORT_INTERVAL_MS - 60_000));
  it("10분이 지나면 0", () => expect(exportWaitMs(0, EXPORT_INTERVAL_MS)).toBe(0));
  it("분은 올림", () => {
    expect(waitMinutes(1)).toBe(1);
    expect(waitMinutes(9 * 60_000 + 1)).toBe(10);
  });
});
