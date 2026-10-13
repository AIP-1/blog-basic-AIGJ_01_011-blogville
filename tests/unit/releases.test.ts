import { describe, expect, it } from "vitest";
import { sanitizeReleaseHtml } from "@/lib/releases";

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
