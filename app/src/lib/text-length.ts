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

/** 에디터 HTML의 글자 수 (JS `length`, 이모지는 2자). 사진·파일 카드는 글자가 없어 0자 */
export function postTextLength(html: string): number {
  const text = decode(html.replace(LINE_END, "$&\n").replace(TAG, ""));
  return text.replace(/[ \t]+\n/g, "\n").trim().length;
}
