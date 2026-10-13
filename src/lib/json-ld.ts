// 검색 엔진이 글의 제목·작성자·날짜를 정확히 읽게 하는 구조화 정보 (schema.org JSON-LD).
// 구글·네이버가 검색 결과에 작성자·날짜를 붙여 보여 줄 때 쓴다.

export type PostJsonLdInput = {
  siteUrl: string;
  blog: { slug: string; title: string };
  post: { id: number; title: string; createdAt: Date; updatedAt: Date };
  nickname: string;
  description: string;
  imageKey: string | null;
  categoryName: string | null;
  categoryHref: string | null;
};

export function postJsonLd(i: PostJsonLdInput) {
  const blogUrl = `${i.siteUrl}/@${i.blog.slug}`;
  const postUrl = `${blogUrl}/${i.post.id}`;
  const crumbs = [
    { name: i.blog.title, item: blogUrl },
    ...(i.categoryName && i.categoryHref ? [{ name: i.categoryName, item: `${i.siteUrl}${i.categoryHref}` }] : []),
    { name: i.post.title, item: postUrl },
  ];
  const posting = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: i.post.title,
    description: i.description,
    url: postUrl,
    mainEntityOfPage: postUrl,
    datePublished: i.post.createdAt.toISOString(),
    dateModified: i.post.updatedAt.toISOString(),
    author: { "@type": "Person", name: i.nickname, url: blogUrl },
    publisher: { "@type": "Organization", name: "Blogville", url: i.siteUrl },
    isPartOf: { "@type": "Blog", name: i.blog.title, url: blogUrl },
    inLanguage: "ko-KR",
    ...(i.imageKey ? { image: `${i.siteUrl}/files/${i.imageKey}` } : {}),
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, n) => ({ "@type": "ListItem", position: n + 1, name: c.name, item: c.item })),
  };
  return [posting, breadcrumb] as const;
}

/** <script> 안에 넣을 JSON. 글 제목의 `</script>` 같은 글자가 태그를 끝내지 못하게 `<`를 바꾼다 */
export function jsonLdText(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
