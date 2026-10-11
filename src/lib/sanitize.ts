import "server-only";
import sanitizeHtml from "sanitize-html";
import { extensionOf, formatBytes, keyFromUrl } from "./attachments";

const LINK_REL = "noopener noreferrer nofollow";

/** 이 글에 붙일 수 있는 첨부 (키 → DB 값). 정화가 이것에 있는 사진·파일 카드만 남긴다. */
export type KnownAttachments = ReadonlyMap<string, { kind: "image" | "file"; name: string; size: number }>;

// 허용하지 않는 태그 이름으로 바꾸면 disallowedTagsMode가 버린다
const DROP: sanitizeHtml.Tag = { tagName: "drop-me", attribs: {} };

/** 저장할 때 쓰는 허용 목록 (NF-03, research §8, 002 FR-006) */
function options(known: KnownAttachments): sanitizeHtml.IOptions {
  return {
    allowedTags: ["p", "br", "h2", "h3", "strong", "em", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "a", "hr", "img"],
    allowedAttributes: {
      a: ["href", "target", "rel", "data-file", "data-name", "data-size", "data-size-label", "data-ext", "aria-label"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      img: (tagName, attribs): sanitizeHtml.Tag => {
        const key = keyFromUrl(attribs.src);
        if (!key || known.get(key)?.kind !== "image") return DROP;
        return { tagName, attribs: { src: `/files/${key}`, alt: "" } };
      },
      a: (tagName, attribs): sanitizeHtml.Tag => {
        if ("data-file" in attribs) {
          // 파일 카드: 이름·크기는 DB 값으로 다시 쓴다 (조작 무시)
          const key = keyFromUrl(attribs.href);
          const file = key ? known.get(key) : undefined;
          if (!key || file?.kind !== "file") return DROP;
          const sizeLabel = formatBytes(file.size);
          return {
            tagName,
            attribs: {
              href: `/files/${key}`,
              "data-file": "",
              "data-name": file.name,
              "data-size": String(file.size),
              "data-size-label": sizeLabel,
              "data-ext": extensionOf(file.name),
              "aria-label": `${file.name} 내려받기 (${sizeLabel})`,
            },
          };
        }
        return {
          tagName,
          attribs: attribs.href ? { href: attribs.href, target: "_blank", rel: LINK_REL } : ({} as sanitizeHtml.Attributes),
        };
      },
    },
  };
}

export function sanitizePostHtml(html: string, known: KnownAttachments = new Map()): string {
  return sanitizeHtml(html, options(known));
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
