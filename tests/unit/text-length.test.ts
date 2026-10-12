import { describe, expect, it } from "vitest";
import { htmlToText, sanitizePostHtml, type KnownAttachments } from "@/lib/sanitize";
import { postTextLength } from "@/lib/text-length";

const known: KnownAttachments = new Map([
  ["a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.png", { kind: "image", name: "사진.png", size: 1000 }],
  ["f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6.pdf", { kind: "file", name: "보고서 > 최종 \"본\".pdf", size: 1_200_000 }],
]);

// 에디터(Tiptap)가 내놓는 모양의 HTML
const SAMPLES: Record<string, string> = {
  빈: "",
  "빈 문단": "<p></p>",
  "빈 문단 여러 개": "<p>가</p><p></p><p></p><p>나</p>",
  한문단: "<p>안녕하세요</p>",
  두문단: "<p>첫 문단</p><p>둘째 문단</p>",
  "줄바꿈 br": "<p>한 줄<br>두 줄</p>",
  "br 뒤 공백": "<p>앞   <br>뒤</p>",
  "이어진 띄어쓰기": "<p>가    나\t다</p>",
  "앞뒤 공백": "<p>   가운데   </p>",
  nbsp: "<p>가&nbsp;&nbsp;나&nbsp;</p>",
  엔티티: "<p>&lt;b&gt; &amp; &quot;따옴표&quot; &#39;작은&#39; &amp;lt;</p>",
  "글자로 쓴 엔티티": "<p>&amp;nbsp; &amp;amp; &amp;quot;</p>",
  이모지: "<p>😀👍🏽 가</p>",
  제목: "<h2>큰 제목</h2><h3>작은 제목</h3><p>본문</p>",
  목록: "<ul><li><p>하나</p></li><li><p>둘</p></li></ul><ol><li><p>셋</p></li></ol>",
  인용: "<blockquote><p>인용 문단</p><p>둘째</p></blockquote><p>뒤</p>",
  코드: '<pre><code class="language-js">const a = 1;\n  return a;\n</code></pre><p>뒤</p>',
  "꾸밈 글자": "<p><strong>굵게</strong> <em>기울임</em> <u>밑줄</u> <s>취소</s> <code>코드</code></p>",
  링크: '<p><a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com/?a=1&amp;b=2">링크 글자</a></p>',
  구분선: "<p>위</p><hr><p>아래</p>",
  사진: '<p>앞</p><img src="/files/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6.png" alt=""><p>뒤</p>',
  "파일 카드": '<p>앞</p><a href="/files/f1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6.pdf" data-file="" data-name="보고서 > 최종 &quot;본&quot;.pdf" data-size="1200000" data-size-label="1.1MB" data-ext="pdf" aria-label="보고서 > 최종 &quot;본&quot;.pdf 내려받기 (1.1MB)"></a><p>뒤</p>',
  "공백만": "<p>   </p><p> </p>",
  "긴 글": `<p>${"가나다라마바사 ".repeat(200)}</p>`,
};

describe("postTextLength는 서버 content_text 길이와 같다", () => {
  for (const [name, html] of Object.entries(SAMPLES)) {
    it(name, () => {
      expect(postTextLength(html)).toBe(htmlToText(sanitizePostHtml(html, known)).length);
    });
  }
  it("몇 가지는 값을 직접 본다", () => {
    expect(postTextLength(SAMPLES.두문단)).toBe("첫 문단\n둘째 문단".length);
    expect(postTextLength(SAMPLES.이모지)).toBe(8); // 😀 2 + 👍 2 + 🏽 2 + 띄어쓰기 + 가
    expect(postTextLength(SAMPLES.사진)).toBe("앞\n뒤".length);
    expect(postTextLength(SAMPLES["빈 문단"])).toBe(0);
  });
});
