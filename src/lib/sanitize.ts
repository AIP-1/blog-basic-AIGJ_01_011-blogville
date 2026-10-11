import "server-only";
import sanitizeHtml from "sanitize-html";

const LINK_REL = "noopener noreferrer nofollow";

/** 저장할 때 쓰는 허용 목록 (NF-03, research §8). 첨부(POST-07·09)가 생기면 img·파일 카드를 더한다. */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "h2", "h3", "strong", "em", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "a", "hr"],
  allowedAttributes: { a: ["href", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs): sanitizeHtml.Tag => ({
      tagName,
      attribs: attribs.href ? { href: attribs.href, target: "_blank", rel: LINK_REL } : ({} as sanitizeHtml.Attributes),
    }),
  },
};

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

/** 태그를 뺀 글자 (요약·빈 본문 판정용). 블록 사이는 줄바꿈으로 띄운다. */
export function htmlToText(html: string): string {
  const spaced = html.replace(/<\/(p|h2|h3|li|blockquote|pre)>|<br\s*\/?>/gi, "$&\n");
  const text = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}
