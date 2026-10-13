// 업데이트 소식 (/updates): GitHub 릴리스 노트를 사이트에 보여 준다. 서버와 시험이 같이 쓰는 순수 함수만 둔다.
import sanitizeHtml from "sanitize-html";

/** 릴리스를 가져올 저장소 (owner/name) */
export const RELEASES_REPO = "handsomeguen/blogville";

/** 그림은 GitHub이 올려 둔 곳에서만 받는다 */
const IMAGE_HOSTS = ["raw.githubusercontent.com", "camo.githubusercontent.com", "user-images.githubusercontent.com", "private-user-images.githubusercontent.com", "github.com"];

/**
 * GitHub이 마크다운을 바꿔 준 릴리스 HTML(body_html)에서 글·표·그림·링크만 남긴다.
 * 스크립트·이벤트·스타일은 지우고, 그림은 GitHub 주소만, 링크는 http(s)만 새 탭으로 연다.
 */
export function sanitizeReleaseHtml(html: string): string {
  // GitHub은 그림마다 원본 링크(<a><img></a>)를 씌운다. 그림이 늦게 뜨는 동안 높이 2px짜리 링크가 되어
  // 누르기 어려운 대상(접근성 target-size)이 되므로 링크를 벗기고 그림만 남긴다
  const unwrapped = html.replace(/<a\b[^>]*>\s*(<img\b[^>]*>)\s*<\/a>/gi, "$1");
  return sanitizeHtml(unwrapped, {
    allowedTags: ["h1", "h2", "h3", "h4", "p", "br", "hr", "ul", "ol", "li", "strong", "em", "del", "code", "pre", "blockquote", "a", "img", "table", "thead", "tbody", "tr", "th", "td"],
    // target·rel·loading은 아래 transformTags가 정한 값으로 덮는다
    allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "loading"], th: ["align"], td: ["align"] },
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    exclusiveFilter: (frame) => {
      if (frame.tag !== "img") return false;
      try {
        return !IMAGE_HOSTS.includes(new URL(frame.attribs.src ?? "").hostname);
      } catch {
        return true;
      }
    },
    transformTags: {
      // 제목은 화면의 h2 아래로 한 칸씩 내린다
      h1: "h3",
      h2: "h3",
      h3: "h4",
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    },
  });
}

export type Release = { tag: string; name: string; publishedAt: Date; url: string; html: string };

/** 아래 막대의 `NEW` 표시를 붙이는 기간: 최신 릴리스가 나온 지 3일 */
export const RELEASE_NEW_DAYS = 3;

/** 최신 릴리스가 3일 안에 나왔는지 (SUP-01). 목록이 없거나 비면 false, 앞으로의 날짜도 새것으로 본다 */
export function hasNewRelease(releases: Pick<Release, "publishedAt">[] | null, now: Date = new Date()): boolean {
  if (!releases || releases.length === 0) return false;
  const latest = Math.max(...releases.map((r) => r.publishedAt.getTime()));
  return now.getTime() - latest < RELEASE_NEW_DAYS * 24 * 60 * 60 * 1000;
}
