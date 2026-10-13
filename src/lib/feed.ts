// 구독·공유·검색 노출 (RSS, 공유 미리보기, sitemap). 서버와 시험이 같이 쓰는 순수 함수만 둔다.

/** 사이트 주소 (끝의 / 없음). 배포에서는 BETTER_AUTH_URL(= 사용자가 여는 주소)을 쓴다. */
export function siteUrl(): string {
  return (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/** 공유 미리보기·RSS 요약: 줄바꿈과 공백을 한 칸으로 줄이고 max자에서 자른다. */
export function excerpt(text: string, max = 150): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

/** 본문의 첫 사진 첨부 키 (공유 미리보기 대표 사진). 없으면 null. */
export function firstImageKey(html: string): string | null {
  return html.match(/<img\b[^>]*\bsrc\s*=\s*["']?\/files\/([0-9a-f]{32})["'\s>]/i)?.[1] ?? null;
}

/** 본문 안의 /files/… 같은 사이트 안 주소를 RSS 리더가 열 수 있게 절대 주소로 바꾼다. */
export function absolutizeHtml(html: string, base: string): string {
  return html.replace(/(\s(?:src|href)\s*=\s*["'])\/(?!\/)/gi, `$1${base}/`);
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // XML 1.0에 넣을 수 없는 제어 문자
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
}

/** CDATA 안에 ]]>가 나오면 나눠 끝나지 않게 한다 */
function cdata(s: string): string {
  return `<![CDATA[${s.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

export type RssPost = { id: number; title: string; contentHtml: string; contentText: string; createdAt: Date; categoryName: string | null };

/** 블로그 하나의 RSS 2.0 (최신 공개 글). description은 요약, content:encoded는 본문 전체. */
export function buildRss(blog: { slug: string; title: string; intro: string; nickname: string }, posts: RssPost[], base: string): string {
  const home = `${base}/@${blog.slug}`;
  const items = posts
    .map((p) => {
      const link = `${home}/${p.id}`;
      return [
        "<item>",
        `<title>${escapeXml(p.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `<pubDate>${p.createdAt.toUTCString()}</pubDate>`,
        `<dc:creator>${escapeXml(blog.nickname)}</dc:creator>`,
        p.categoryName ? `<category>${escapeXml(p.categoryName)}</category>` : "",
        `<description>${escapeXml(excerpt(p.contentText, 300))}</description>`,
        `<content:encoded>${cdata(absolutizeHtml(p.contentHtml, base))}</content:encoded>`,
        "</item>",
      ].join("");
    })
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">',
    "<channel>",
    `<title>${escapeXml(blog.title)}</title>`,
    `<link>${escapeXml(home)}</link>`,
    `<atom:link href="${escapeXml(`${home}/rss`)}" rel="self" type="application/rss+xml"/>`,
    `<description>${escapeXml(blog.intro || `${blog.nickname}님의 블로그`)}</description>`,
    "<language>ko</language>",
    posts[0] ? `<lastBuildDate>${posts[0].createdAt.toUTCString()}</lastBuildDate>` : "",
    "<generator>Blogville</generator>",
    items,
    "</channel>",
    "</rss>",
  ]
    .filter(Boolean)
    .join("\n");
}
