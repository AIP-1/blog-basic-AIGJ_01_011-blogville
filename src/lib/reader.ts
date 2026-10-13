// 글 읽기 편의 (읽는 시간·목차): 서버와 시험이 같이 쓰는 순수 함수만 둔다.

/** 한국어 글을 1분에 읽는 글자 수 (공백 제외, 대략) */
export const CHARS_PER_MINUTE = 500;

/** "약 N분 읽기"의 N. 공백을 뺀 글자 수 ÷ 500, 반올림, 최소 1분. */
export function readingMinutes(text: string): number {
  const chars = text.replace(/\s+/g, "").length;
  return Math.max(1, Math.round(chars / CHARS_PER_MINUTE));
}

/** 목차는 소제목(h2·h3)이 이만큼 있어야 보인다 */
export const TOC_MIN_HEADINGS = 3;

export type TocItem = { id: string; text: string; level: 2 | 3 };

/** 글 화면에 이미 있는 id. 소제목 id가 이것과 겹치지 않게 한다. */
const RESERVED_IDS = ["comments", "comments-title", "like-login", "main", "toc"];

/** HTML 글자 참조를 글자로 (정화된 HTML의 글자만 다룬다) */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
    return named[ref.toLowerCase()] ?? whole;
  });
}

/** 태그를 빼고 글자 참조를 푼 글자 */
export function innerText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ""));
}

/**
 * 소제목 글자 → 주소 끝(#...)에 쓸 id. 한글·영문·숫자는 그대로, 공백은 -, 나머지 기호는 뺀다.
 * 결과는 글자(\p{L})·숫자(\p{N})·-·_만이라 속성에 그대로 넣어도 안전하다.
 */
export function headingSlug(text: string): string {
  const slug = text
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "section";
}

/**
 * 정화된 본문의 h2·h3에 겹치지 않는 id를 달고 목차 항목을 돌려준다.
 * 정화(sanitize.ts)는 h2·h3에 속성을 남기지 않으므로 여는 태그는 늘 `<h2>`·`<h3>`이다.
 */
export function addHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const used = new Set(RESERVED_IDS);
  const toc: TocItem[] = [];
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_whole, level: string, inner: string) => {
    const text = innerText(inner).replace(/\s+/g, " ").trim();
    const base = headingSlug(text);
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    if (text) toc.push({ id, text, level: level === "2" ? 2 : 3 });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, toc };
}
