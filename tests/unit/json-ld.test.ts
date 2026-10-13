import { describe, expect, it } from "vitest";
import { jsonLdText, postJsonLd } from "@/lib/json-ld";

const base = {
  siteUrl: "https://example.com",
  blog: { slug: "sky", title: "하늘 블로그" },
  post: { id: 7, title: "첫 글", createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-02T00:00:00Z") },
  nickname: "하늘",
  description: "요약",
  imageKey: null,
  categoryName: null,
  categoryHref: null,
};

describe("postJsonLd", () => {
  it("글 정보와 작성자·날짜를 절대 주소로 담는다", () => {
    const [post, crumbs] = postJsonLd(base);
    expect(post).toMatchObject({
      "@type": "BlogPosting",
      headline: "첫 글",
      url: "https://example.com/@sky/7",
      datePublished: "2026-10-01T00:00:00.000Z",
      dateModified: "2026-10-02T00:00:00.000Z",
      author: { name: "하늘", url: "https://example.com/@sky" },
    });
    expect(post).not.toHaveProperty("image");
    expect(crumbs.itemListElement).toHaveLength(2);
  });

  it("카테고리와 대표 사진이 있으면 넣는다", () => {
    const [post, crumbs] = postJsonLd({ ...base, imageKey: "abc", categoryName: "여행", categoryHref: "/@sky?category=3" });
    expect(post).toMatchObject({ image: "https://example.com/files/abc" });
    expect(crumbs.itemListElement.map((c: { position: number; item: string }) => [c.position, c.item])).toEqual([
      [1, "https://example.com/@sky"],
      [2, "https://example.com/@sky?category=3"],
      [3, "https://example.com/@sky/7"],
    ]);
  });
});

describe("jsonLdText", () => {
  it("</script>로 태그를 끝내지 못하게 한다", () => {
    const text = jsonLdText({ headline: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text).headline).toBe("</script><script>alert(1)</script>");
  });
});
