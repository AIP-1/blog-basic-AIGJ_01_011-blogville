// 글쓰기 화면의 글자 수 `N자` (POST-01). 서버가 저장하는 `content_text`(`htmlToText(sanitizePostHtml(html))`, src/lib/sanitize.ts)의
// 길이와 같은 값을 브라우저에서 센다 (서버의 sanitize-html은 브라우저에서 쓰지 않는다). 규칙을 바꾸면 htmlToText와 tests/unit/text-length.test.ts를 함께 고친다.

/** 서버와 같다: 문단·제목·목록 항목·인용·코드 블록이 끝날 때와 줄바꿈(br) 뒤에 줄바꿈 1자 */
const LINE_END = /<\/(p|h2|h3|li|blockquote|pre)>|<br\s*\/?>/gi;
/** 태그 (따옴표 안의 `>`는 태그 끝이 아니다) */
const TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const ENTITY = /&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g;
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(text: string): string {
  return text.replace(ENTITY, (whole, name: string) => {
    if (name[0] !== "#") return NAMED[name] ?? whole;
    const code = name[1] === "x" || name[1] === "X" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

/**
 * 줄 끝의 빈칸·탭을 지운다 (`/[ \t]+\n/g`와 같은 결과). 정규식은 줄바꿈 없는 긴 빈칸에서 시간이
 * 제곱으로 늘어(빈칸 4만 자에 2초) 글 저장·글자 수 세기가 멈출 수 있어서 한 번 훑는 방식으로 한다.
 */
export function trimLineEnds(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      let end = line.length;
      while (end > 0 && (line.charCodeAt(end - 1) === 32 || line.charCodeAt(end - 1) === 9)) end--;
      return end === line.length ? line : line.slice(0, end);
    })
    .join("\n");
}

/** 에디터 HTML의 글자 수 (JS `length`, 이모지는 2자). 사진·파일 카드는 글자가 없어 0자 */
export function postTextLength(html: string): number {
  const text = decode(html.replace(LINE_END, "$&\n").replace(TAG, ""));
  return trimLineEnds(text).trim().length;
}
