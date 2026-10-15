import { describe, expect, it } from "vitest";
import { compareVersions, htmlToText, imagePaths, noteTitle, noteToHtml, versionOfFile } from "@/lib/release-note";

const links = {
  image: (rel: string) => (rel.endsWith("missing.png") ? null : `/files/${rel.length.toString(16).padStart(32, "0")}`),
  link: (rel: string) => `https://example.test/${rel}`,
};

describe("릴리스 노트 → 공지 글", () => {
  it("파일 이름에서 버전, 버전 순서 (1.10.0 > 1.9.0)", () => {
    expect(versionOfFile("v1.2.3.md")).toBe("1.2.3");
    expect(versionOfFile("README.md")).toBeNull();
    expect(["1.10.0", "1.9.0", "1.0.0"].sort(compareVersions)).toEqual(["1.0.0", "1.9.0", "1.10.0"]);
  });

  it("첫 줄 # 제목이 글 제목, 본문에서는 빠진다", () => {
    const md = "# Blogville v1.0.0 (2026-10-13)\n\n첫 문단";
    expect(noteTitle(md, "1.0.0")).toBe("Blogville v1.0.0 (2026-10-13)");
    expect(noteToHtml(md, links)).toBe("<p>첫 문단</p>");
    expect(noteTitle("본문만", "2.0.0")).toBe("Blogville v2.0.0");
  });

  it("제목·목록·굵게·코드·링크", () => {
    const html = noteToHtml("## 새 기능\n\n- **방명록** `/@주소/guestbook`\n- [규칙](../../CONTRIBUTING.md)\n\n1. 하나\n2. 둘", links);
    expect(html).toContain("<h2>새 기능</h2>");
    expect(html).toContain("<li><strong>방명록</strong> <code>/@주소/guestbook</code></li>");
    expect(html).toContain('<a href="https://example.test/../../CONTRIBUTING.md"');
    expect(html).toContain("<ol><li>하나</li><li>둘</li></ol>");
  });

  it("글자는 이스케이프한다 (노트에 HTML을 써도 태그가 되지 않음)", () => {
    expect(noteToHtml("<script>alert(1)</script> & 끝", links)).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; 끝</p>");
  });

  it("그림은 첨부 주소로, 못 찾은 그림은 뺀다", () => {
    const html = noteToHtml("![a](img/v1/a.png)\n\n![b](img/v1/missing.png)", links);
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).toMatch(/<img src="\/files\/[0-9a-f]{32}" alt="">/);
    expect(imagePaths("![a](img/a.png) ![a](img/a.png) ![c](https://x/c.png)")).toEqual(["img/a.png"]);
  });

  it("글 표는 목록, 그림 표는 머리글 + 그림으로", () => {
    const text = noteToHtml("| | 새로 생긴 것 |\n|---|---|\n| 📝 블로그 | 대표 사진 |\n| 💬 소통 | 방명록 |", links);
    expect(text).toBe("<ul><li><strong>📝 블로그</strong> 대표 사진</li><li><strong>💬 소통</strong> 방명록</li></ul>");
    const pics = noteToHtml("| 주인 화면 | 손님 화면 |\n|---|---|\n| ![a](img/a.png) | ![b](img/b.png) |", links);
    expect(pics).toMatch(/^<p><strong>주인 화면<\/strong><\/p><p><img [^>]+><\/p><p><strong>손님 화면<\/strong><\/p><p><img [^>]+><\/p>$/);
  });

  it("요약 글자는 태그를 뺀다", () => {
    expect(htmlToText("<h2>제목</h2><p>A &amp; B</p>")).toBe("제목 A & B");
  });
});

describe("릴리스 노트 한 줄 요약", () => {
  it("모든 노트는 제목 다음 줄에 한 줄 요약 문단이 있다 (업데이트 소식 목록에 보이는 글)", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const dir = "docs/releases";
    const missing = readdirSync(dir)
      .filter((f) => /^v\d+\.\d+\.\d+\.md$/.test(f))
      .filter((f) => {
        const lines = readFileSync(`${dir}/${f}`, "utf8").split("\n");
        const lead = lines.slice(1).find((l) => l.trim()) ?? "";
        return /^(#|\||!\[|-\s|\d+\.\s)/.test(lead.trim()) || !lead.trim();
      });
    expect(missing).toEqual([]);
  });
});
