import "server-only";
import sanitizeHtml from "sanitize-html";
import { extensionOf, formatBytes, keyFromUrl } from "./attachments";
import { youtubeEmbedSrc, youtubeId } from "./youtube";

const LINK_REL = "noopener noreferrer nofollow";

/** 이 글에 붙일 수 있는 첨부 (키 → DB 값). 정화가 이것에 있는 사진·파일 카드만 남긴다. */
export type KnownAttachments = ReadonlyMap<string, { kind: "image" | "file"; name: string; size: number }>;

// 허용하지 않는 태그 이름으로 바꾸면 disallowedTagsMode가 버린다. 닫는 태그가 없는 태그(img)에만 쓴다
// (여닫는 태그에 쓰면 sanitize-html이 다음 닫는 태그를 </drop-me>로 잘못 짝짓는다)
const DROP: sanitizeHtml.Tag = { tagName: "drop-me", attribs: {} };

/**
 * 글 본문에 남기는 태그·속성 (저장할 때와 보여 줄 때 같은 목록을 쓴다).
 * 표·문단 정렬·YouTube(개선 9): 표는 칸 합치기 수만, 정렬은 text-align만, 영상은 쿠키 없는 YouTube 틀만.
 */
export const POST_ALLOWED_TAGS = [
  "p", "br", "h2", "h3", "strong", "em", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "a", "hr", "img",
  "table", "colgroup", "col", "tbody", "tr", "th", "td", "div", "iframe",
];
export const POST_ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel", "data-file", "data-name", "data-size", "data-size-label", "data-ext", "aria-label"],
  img: ["src", "alt"],
  p: ["style"],
  h2: ["style"],
  h3: ["style"],
  th: ["colspan", "rowspan"],
  td: ["colspan", "rowspan"],
  div: ["data-youtube-video"],
  iframe: ["src", "width", "height", "allowfullscreen", "allow", "title", "loading", "referrerpolicy"],
};
export const POST_ALLOWED_STYLES: sanitizeHtml.IOptions["allowedStyles"] = {
  "*": { "text-align": [/^(left|center|right)$/] },
};
/**
 * YouTube 틀: 주소에서 영상 ID만 다시 꺼내 쿠키 없는 주소로 새로 쓴다. 아니면 주소를 비우고 exclusiveFilter가 통째로 버린다
 * (태그 이름을 바꿔 버리면 sanitize-html이 뒤따르는 닫는 태그를 잘못 짝짓는다)
 */
export function youtubeFrame(tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const id = attribs.src ? youtubeId(attribs.src) : null;
  if (!id) return { tagName, attribs: {} };
  return {
    tagName,
    attribs: {
      src: youtubeEmbedSrc(id),
      width: "640",
      height: "360",
      title: "YouTube 영상",
      loading: "lazy",
      allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture",
      allowfullscreen: "true",
      referrerpolicy: "strict-origin-when-cross-origin",
    },
  };
}
/** 주소가 없는(허용하지 않은) 틀, 틀이 빠진 YouTube 상자, 주소도 글자도 없는 링크는 통째로 버린다 */
export const dropEmptyFrame = (frame: sanitizeHtml.IFrame) =>
  (frame.tag === "iframe" && !frame.attribs.src) ||
  (frame.tag === "div" && "data-youtube-video" in frame.attribs && frame.mediaChildren.length === 0) ||
  (frame.tag === "a" && !frame.attribs.href && !frame.text.trim());

/** div는 YouTube 상자 표시만 남기고, 나머지 div는 속성 없는 div로 (태그 이름을 바꾸면 닫는 태그가 어긋난다) */
export function youtubeWrapper(tagName: string, attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  return { tagName, attribs: "data-youtube-video" in attribs ? { "data-youtube-video": "" } : {} };
}

/** 저장할 때 쓰는 허용 목록 (NF-03, research §8, 002 FR-006) */
function options(known: KnownAttachments): sanitizeHtml.IOptions {
  return {
    allowedTags: POST_ALLOWED_TAGS,
    allowedAttributes: POST_ALLOWED_ATTRIBUTES,
    allowedStyles: POST_ALLOWED_STYLES,
    allowedIframeHostnames: ["www.youtube-nocookie.com"],
    exclusiveFilter: dropEmptyFrame,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      iframe: youtubeFrame,
      div: youtubeWrapper,
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
          // 모르는 파일 카드는 주소 없는 a로 (이름을 바꿔 버리면 뒤따르는 닫는 태그가 어긋난다)
          if (!key || file?.kind !== "file") return { tagName, attribs: {} };
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
  // 표 칸 안은 문단이라 칸마다 줄이 나뉜다
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
