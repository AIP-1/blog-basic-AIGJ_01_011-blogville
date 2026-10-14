import { describe, expect, it } from "vitest";
import { isReleaseTag, releaseSummary, releaseTitle, sanitizeReleaseHtml } from "@/lib/releases";

describe("업데이트 소식 (릴리스 노트 HTML)", () => {
  it("글·표·GitHub 그림은 남기고 제목은 한 칸 내린다", () => {
    const out = sanitizeReleaseHtml(
      '<h2>새 기능</h2><p><strong>방명록</strong></p><table><tr><th>a</th><td>b</td></tr></table><img src="https://raw.githubusercontent.com/o/r/v1/a.png" alt="그림" style="max-width:100%">',
    );
    expect(out).toContain("<h3>새 기능</h3>");
    expect(out).toContain("<strong>방명록</strong>");
    expect(out).toContain("<th>a</th>");
    expect(out).toContain('<img src="https://raw.githubusercontent.com/o/r/v1/a.png" alt="그림" loading="lazy" />');
    expect(out).not.toContain("style");
  });

  it("스크립트·이벤트·바깥 그림·javascript 링크는 지우고, 링크는 새 탭으로", () => {
    const out = sanitizeReleaseHtml(
      '<script>alert(1)</script><img src="https://evil.example/x.png"><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">나쁨</a><a href="https://github.com/o/r" onclick="x()">좋음</a>',
    );
    expect(out).not.toMatch(/script|onerror|onclick|evil|javascript/);
    expect(out).toContain('<a href="https://github.com/o/r" target="_blank" rel="noopener noreferrer">좋음</a>');
  });
});

describe("업데이트 소식: 그림을 감싼 링크", () => {
  it("GitHub이 그림에 씌운 원본 링크는 벗기고 그림만 남긴다", () => {
    const out = sanitizeReleaseHtml('<p><a href="https://raw.githubusercontent.com/o/r/a.png"><img src="https://raw.githubusercontent.com/o/r/a.png" alt="그림"></a></p><p><a href="https://github.com/o/r">글 링크</a></p>');
    expect(out).toContain('<p><img src="https://raw.githubusercontent.com/o/r/a.png" alt="그림" loading="lazy" /></p>');
    expect(out).toContain(">글 링크</a>");
  });
});

describe("업데이트 소식 목록", () => {
  it("한 줄 요약은 첫 문단의 글자만, 길면 …로 자른다", () => {
    expect(releaseSummary("<h3>제목</h3><p>새 기능이 <strong>둘</strong> 생겼어요 &amp; 고쳤어요.</p><p>둘째 문단</p>")).toBe("새 기능이 둘 생겼어요 & 고쳤어요.");
    expect(releaseSummary(`<p>${"가".repeat(100)}</p>`, 10)).toBe(`${"가".repeat(9)}…`);
    expect(releaseSummary("<table><tr><td>표만</td></tr></table>")).toBe("");
  });
  it("버전 주소는 v숫자.숫자.숫자만", () => {
    expect(isReleaseTag("v1.6.0")).toBe(true);
    expect(isReleaseTag("v10.0.12")).toBe(true);
    for (const bad of ["1.6.0", "v1.6", "v1.6.0-beta", "../etc", "v1.6.0/x"]) expect(isReleaseTag(bad)).toBe(false);
  });
});

it("제목 끝의 날짜는 뺀다", () => {
  expect(releaseTitle("Blogville v1.6.0 (2026-10-14)")).toBe("Blogville v1.6.0");
  expect(releaseTitle("v1.0.0")).toBe("v1.0.0");
});
