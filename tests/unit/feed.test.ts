import { describe, expect, it } from "vitest";
import { absolutizeHtml, buildRss, escapeXml, excerpt, firstImageKey } from "@/lib/feed";

const KEY = "0123456789abcdef0123456789abcdef";

describe("구독·공유 (RSS, 공유 미리보기)", () => {
  it("요약은 공백을 한 칸으로 줄이고 넘치면 …로 자른다", () => {
    expect(excerpt("  첫 줄\n\n둘째   줄 ")).toBe("첫 줄 둘째 줄");
    expect(excerpt("가".repeat(200), 10)).toBe(`${"가".repeat(9)}…`);
    expect(excerpt("짧은 글", 10)).toBe("짧은 글");
  });

  it("대표 사진은 본문의 첫 사진 첨부, 파일 카드 링크나 바깥 사진은 아니다", () => {
    expect(firstImageKey(`<p>글</p><img src="/files/${KEY}" alt="">`)).toBe(KEY);
    expect(firstImageKey(`<a href="/files/${KEY}">파일</a>`)).toBeNull();
    expect(firstImageKey(`<img src="https://evil.example/x.png">`)).toBeNull();
    expect(firstImageKey("<p>사진 없음</p>")).toBeNull();
  });

  it("사이트 안 주소를 절대 주소로, 바깥·// 주소는 그대로", () => {
    const html = `<img src="/files/${KEY}"><a href="/@demo/1">글</a><a href="https://x.dev/a">밖</a><a href="//cdn.x/a">밖</a>`;
    expect(absolutizeHtml(html, "https://blog.example")).toBe(
      `<img src="https://blog.example/files/${KEY}"><a href="https://blog.example/@demo/1">글</a><a href="https://x.dev/a">밖</a><a href="//cdn.x/a">밖</a>`,
    );
  });

  it("XML 특수 문자와 넣을 수 없는 제어 문자를 처리한다", () => {
    expect(escapeXml(`<a & "b" 'c'>\u0001`)).toBe("&lt;a &amp; &quot;b&quot; &apos;c&apos;&gt;");
  });

  it("RSS 2.0: 채널·글 주소, 요약과 본문 전체, ]]>가 들어 있어도 CDATA가 깨지지 않는다", () => {
    const xml = buildRss(
      { slug: "demo", title: "데모 & 블로그", intro: "", nickname: "데모" },
      [
        { id: 7, title: "<첫 글>", contentHtml: `<p>본문 ]]> 끝</p><img src="/files/${KEY}">`, contentText: "본문 ]]> 끝", createdAt: new Date("2026-10-13T00:00:00Z"), categoryName: "일상" },
      ],
      "https://blog.example",
    );
    expect(xml).toContain("<title>데모 &amp; 블로그</title>");
    expect(xml).toContain("<description>데모님의 블로그</description>");
    expect(xml).toContain('<atom:link href="https://blog.example/@demo/rss" rel="self" type="application/rss+xml"/>');
    expect(xml).toContain("<link>https://blog.example/@demo/7</link>");
    expect(xml).toContain("<title>&lt;첫 글&gt;</title>");
    expect(xml).toContain("<pubDate>Tue, 13 Oct 2026 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<category>일상</category>");
    expect(xml).toContain(`<content:encoded><![CDATA[<p>본문 ]]]]><![CDATA[> 끝</p><img src="https://blog.example/files/${KEY}">]]></content:encoded>`);
  });

  it("글이 없으면 item 없이 채널만", () => {
    const xml = buildRss({ slug: "a", title: "빈 블로그", intro: "소개", nickname: "n" }, [], "http://x");
    expect(xml).not.toContain("<item>");
    expect(xml).not.toContain("lastBuildDate");
    expect(xml).toContain("<description>소개</description>");
  });
});
