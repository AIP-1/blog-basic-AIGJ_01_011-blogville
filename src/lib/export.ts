// 내 블로그 내보내기 (백업 .zip). 서버가 쓰는 순수 함수만 둔다 — 데이터 모으기·압축은 src/server/export.ts

import { extensionOf, formatBytes } from "./attachments";
import { todayKST } from "./kst";

/** 한 회원이 내보내기를 다시 할 수 있기까지 (10분) */
export const EXPORT_INTERVAL_MS = 10 * 60 * 1000;

export const EXPORT_MESSAGES = {
  wait: (minutes: number) => `내보내기는 10분에 한 번 할 수 있어요. ${minutes}분 뒤에 다시 시도해 주세요`,
} as const;

/** 지난번 내보내기 시각으로 남은 기다림 (ms). 0이면 지금 할 수 있다 */
export function exportWaitMs(lastAt: number | undefined, now: number): number {
  return lastAt === undefined ? 0 : Math.max(0, lastAt + EXPORT_INTERVAL_MS - now);
}

/** 남은 기다림을 분으로 (올림, 1~10분) */
export function waitMinutes(ms: number): number {
  return Math.min(10, Math.max(1, Math.ceil(ms / 60_000)));
}

/** `blogville-주소-20261013.zip` (한국 날짜) */
export function exportFileName(slug: string, now = new Date()): string {
  return `blogville-${slug}-${todayKST(now).replaceAll("-", "")}.zip`;
}

/** 파일 이름에 쓸 제목: 한글·영문·숫자만 남기고 나머지는 `-`로, 40자까지. 남는 것이 없으면 `post` */
export function slugifyTitle(title: string): string {
  const slug = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{Script=Hangul}a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const cut = [...slug].slice(0, 40).join("").replace(/-+$/, "");
  return cut || "post";
}

/** 압축 파일 안의 글 파일 이름 (확장자 없이): `posts/12-첫-글` */
export function postBaseName(id: number, title: string): string {
  return `posts/${id}-${slugifyTitle(title)}`;
}

/** 첨부를 압축 파일 안에 둘 이름: `files/키.확장자` */
export function attachmentPath(a: { key: string; name: string; mime: string }): string {
  const ext = extensionOf(a.name).replace(/[^a-z0-9]/g, "") || MIME_EXT[a.mime] || "bin";
  return `files/${a.key}.${ext}`;
}

const MIME_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

/**
 * 본문의 `/files/키` 주소를 압축 파일 안의 상대 경로로 바꾼다. 글 파일은 posts/ 안에 있어 `../files/키.확장자`.
 * 내보내는 첨부에 없는 키는 그대로 둔다.
 */
export function rewriteFileUrls(html: string, paths: ReadonlyMap<string, string>, prefix = "../"): string {
  return html.replace(/((?:src|href)\s*=\s*["'])\/files\/([0-9a-f]{32})(["'])/gi, (whole, before: string, key: string, after: string) => {
    const p = paths.get(key);
    return p ? `${before}${prefix}${p}${after}` : whole;
  });
}

// ─── HTML → Markdown (저장할 때 허용하는 태그만: src/lib/sanitize.ts) ───

type Node = { tag: string; attrs: Record<string, string>; children: Node[] } | string;

const VOID = new Set(["br", "hr", "img"]);

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|#39);/gi, (_, e: string) => {
    const lower = e.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith("#")) return String.fromCodePoint(Number(lower.slice(1)));
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[lower] ?? "";
  });
}

function parse(html: string): Node[] {
  const root: Node = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9-]*)([^>]*)>|([^<]+)|</gi)) {
    const top = stack[stack.length - 1] as Exclude<Node, string>;
    if (m[4] !== undefined || m[0] === "<") {
      top.children.push(decodeEntities(m[4] ?? "<"));
      continue;
    }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      // 닫는 태그: 같은 태그가 열려 있을 때만 닫는다
      const at = stack.map((n) => (n as Exclude<Node, string>).tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(/([a-z][a-z0-9-]*)\s*(?:=\s*"([^"]*)"|=\s*'([^']*)')?/gi)) {
      attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? "");
    }
    const node: Node = { tag, attrs, children: [] };
    top.children.push(node);
    if (!VOID.has(tag) && !m[3].trim().endsWith("/")) stack.push(node);
  }
  return root.children;
}

function textOf(nodes: Node[]): string {
  return nodes.map((n) => (typeof n === "string" ? n : n.tag === "br" ? "\n" : textOf(n.children))).join("");
}

function escapeMd(text: string): string {
  return text.replace(/[\\`*_[\]<>~]/g, "\\$&");
}

function inline(nodes: Node[]): string {
  return nodes
    .map((n): string => {
      if (typeof n === "string") return escapeMd(n.replace(/\s+/g, " "));
      const inner = () => inline(n.children);
      switch (n.tag) {
        case "strong":
          return wrap("**", inner());
        case "em":
          return wrap("*", inner());
        case "s":
          return wrap("~~", inner());
        case "u":
          return `<u>${inner()}</u>`;
        case "code": {
          const code = textOf(n.children);
          const fence = code.includes("`") ? "`` " : "`";
          return `${fence}${code}${fence.split("").reverse().join("")}`;
        }
        case "br":
          return "  \n";
        case "img":
          return `![${escapeMd(n.attrs.alt ?? "")}](${n.attrs.src ?? ""})`;
        case "a": {
          const href = n.attrs.href ?? "";
          if ("data-file" in n.attrs) {
            const name = n.attrs["data-name"] || textOf(n.children).trim() || "파일";
            const size = n.attrs["data-size"] ? ` (${formatBytes(Number(n.attrs["data-size"]))})` : "";
            return `[📎 ${escapeMd(name)}${size}](${href})`;
          }
          const label = inner().trim() || escapeMd(href);
          return href ? `[${label}](${href})` : label;
        }
        default:
          return inner();
      }
    })
    .join("");
}

/** `**  굵게 **` → ` **굵게** ` (Markdown은 표시 안쪽 빈칸을 싫어한다) */
function wrap(mark: string, s: string): string {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : s;
}

function indent(text: string, first: string, rest: string): string {
  return text
    .split("\n")
    .map((line, i) => (i === 0 ? first : line ? rest : "") + line)
    .join("\n");
}

/** 블록을 이어 붙인다. 목록 항목 안은 빈 줄 없이 (빈 줄이 있으면 느슨한 목록이 된다) */
function blocks(nodes: Node[], sep = "\n\n"): string {
  const out: string[] = [];
  let run: Node[] = [];
  const flush = () => {
    const text = inline(run).trim();
    if (text) out.push(text);
    run = [];
  };
  for (const n of nodes) {
    if (typeof n === "string" || !BLOCK.has(n.tag)) {
      run.push(n);
      continue;
    }
    flush();
    switch (n.tag) {
      case "p":
        out.push(inline(n.children).trim().replace(/^(#{1,6}\s|>|[-+] |\d+\. )/, "\\$1"));
        break;
      case "h2":
        out.push(`## ${inline(n.children).trim()}`);
        break;
      case "h3":
        out.push(`### ${inline(n.children).trim()}`);
        break;
      case "hr":
        out.push("---");
        break;
      case "pre": {
        const code = textOf(n.children).replace(/\n$/, "");
        const fence = code.includes("```") ? "~~~~" : "```";
        out.push(`${fence}\n${code}\n${fence}`);
        break;
      }
      case "blockquote":
        out.push(
          blocks(n.children)
            .split("\n")
            .map((line) => (line ? `> ${line}` : ">"))
            .join("\n"),
        );
        break;
      case "ul":
      case "ol": {
        const items = n.children.filter((c): c is Exclude<Node, string> => typeof c !== "string" && c.tag === "li");
        out.push(
          items
            .map((li, i) => {
              const marker = n.tag === "ul" ? "- " : `${i + 1}. `;
              return indent(blocks(li.children, "\n"), marker, " ".repeat(marker.length));
            })
            .join("\n"),
        );
        break;
      }
    }
  }
  flush();
  return out.filter((b) => b !== "").join(sep);
}

const BLOCK = new Set(["p", "h2", "h3", "hr", "pre", "blockquote", "ul", "ol"]);

/** 정화된 본문 HTML → Markdown */
export function htmlToMarkdown(html: string): string {
  const md = blocks(parse(html)).replace(/\n{3,}/g, "\n\n").trim();
  return md ? `${md}\n` : "";
}

// ─── 글 한 편: 읽을 수 있는 HTML·Markdown ───

export type ExportPost = {
  id: number;
  title: string;
  contentHtml: string;
  createdAt: Date;
  updatedAt: Date;
  category: string | null;
  series: string | null;
  tags: string[];
  visibility: string;
};

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const dateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** `2026-10-13 14:05` (한국 시간) */
export function formatKST(d: Date): string {
  return dateTime.format(d);
}

/** 공개 범위 글자 */
export function visibilityLabel(p: { isPublic: boolean; publishAt: Date | null; blindedAt: Date | null }): string {
  if (p.blindedAt) return "비공개 (관리자가 가린 글)";
  if (p.publishAt) return `예약 발행 (${formatKST(p.publishAt)} 공개 예정, 지금은 비공개)`;
  return p.isPublic ? "공개" : "비공개";
}

const PAGE_CSS = `body{max-width:720px;margin:2rem auto;padding:0 1rem;font-family:Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;line-height:1.75;color:#222}
img{max-width:100%;height:auto}pre{background:#f5f5f5;padding:1rem;overflow:auto;border-radius:8px}code{font-family:ui-monospace,Menlo,monospace}
blockquote{margin:1rem 0;padding-left:1rem;border-left:4px solid #ddd;color:#555}.meta{color:#666;font-size:.9rem}.meta dt{font-weight:bold;float:left;clear:left;margin-right:.5rem}
.meta dd{margin:0}.tags span{display:inline-block;margin-right:.4rem;color:#2563eb}a[data-file]::before{content:"📎 "}a[data-file]::after{content:" (" attr(data-size-label) ")";color:#666}`;

/** 내려받은 파일을 열 때 밖으로 아무것도 부르지 않게 (사진은 압축 파일 안의 것만) */
const PAGE_CSP = "default-src 'none'; img-src 'self' file: data:; style-src 'unsafe-inline'";

function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${PAGE_CSP}">
<title>${escapeHtml(title)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
${body}
</body>
</html>
`;
}

/** 글 한 편을 혼자 열리는 HTML로. 본문은 저장 때 정화된 HTML(주소만 바꾼 것)을 그대로 넣는다 */
export function renderPostHtml(p: ExportPost, blogTitle: string, paths: ReadonlyMap<string, string>): string {
  const meta: [string, string][] = [
    ["작성", formatKST(p.createdAt)],
    ["수정", formatKST(p.updatedAt)],
    ["카테고리", p.category ?? "(없음)"],
    ...(p.series ? ([["시리즈", p.series]] as [string, string][]) : []),
    ["공개 범위", p.visibility],
  ];
  const tags = p.tags.length ? `<p class="tags">${p.tags.map((t) => `<span>#${escapeHtml(t)}</span>`).join("")}</p>\n` : "";
  return page(
    `${p.title} | ${blogTitle}`,
    `<p class="meta"><a href="../index.html">← ${escapeHtml(blogTitle)} 글 목록</a></p>
<article>
<h1>${escapeHtml(p.title)}</h1>
<dl class="meta">${meta.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join("")}</dl>
${tags}<hr>
${rewriteFileUrls(p.contentHtml, paths)}
</article>`,
  );
}

/** 글 한 편을 Markdown으로 (앞머리에 정보) */
export function renderPostMarkdown(p: ExportPost, paths: ReadonlyMap<string, string>): string {
  const q = (s: string) => JSON.stringify(s); // JSON 문자열은 YAML 문자열로도 맞다
  const front = [
    "---",
    `title: ${q(p.title)}`,
    `date: ${q(formatKST(p.createdAt))}`,
    `updated: ${q(formatKST(p.updatedAt))}`,
    `category: ${p.category ? q(p.category) : "null"}`,
    ...(p.series ? [`series: ${q(p.series)}`] : []),
    `tags: [${p.tags.map(q).join(", ")}]`,
    `visibility: ${q(p.visibility)}`,
    "---",
  ].join("\n");
  return `${front}\n\n# ${escapeMd(p.title)}\n\n${htmlToMarkdown(rewriteFileUrls(p.contentHtml, paths))}`;
}

/** 압축 파일 첫 화면: 글 목록 */
export function renderIndexHtml(blog: { title: string; slug: string }, posts: { title: string; file: string; date: Date; visibility: string }[]): string {
  const rows = posts
    .map((p) => `<li><a href="${escapeHtml(p.file)}">${escapeHtml(p.title)}</a> <span class="meta">${formatKST(p.date)} · ${escapeHtml(p.visibility)}</span></li>`)
    .join("\n");
  return page(
    `${blog.title} 백업`,
    `<h1>${escapeHtml(blog.title)}</h1>\n<p class="meta">@${escapeHtml(blog.slug)} · 글 ${posts.length}편</p>\n<ul>\n${rows}\n</ul>`,
  );
}

export function readmeText(blog: { title: string; slug: string }, counts: { posts: number; files: number; comments: number; guestbook: number }, now: Date): string {
  return `Blogville 블로그 백업
=====================

블로그: ${blog.title} (@${blog.slug})
내보낸 때: ${formatKST(now)} (한국 시간)
글 ${counts.posts}편 · 첨부 ${counts.files}개 · 댓글 ${counts.comments}개 · 방명록 ${counts.guestbook}개

들어 있는 것
------------
index.html        글 목록. 브라우저로 열면 글을 하나씩 읽을 수 있어요.
blog.json         블로그 정보, 카테고리(대분류·소분류), 시리즈, 글 목록과 정보
posts/*.html      글 한 편씩. 제목·날짜·카테고리·태그·공개 범위와 본문 (브라우저로 열기)
posts/*.md        같은 글의 Markdown. 다른 블로그·메모 앱으로 옮길 때 써요
files/            글에 넣은 사진과 파일 (이름은 "첨부 키.확장자", 원래 이름은 blog.json의 attachments)
comments.json     내 글에 달린 댓글과 답글
guestbook.json    내 방명록과 내 답글

알아 두세요
-----------
- 비공개 글과 예약 발행 글도 들어 있어요. 공개 범위는 글마다 "공개 범위"에 적혀 있어요.
- 비밀 댓글·비밀 방명록도 블로그 주인은 볼 수 있어서 함께 들어 있어요 (secret: true).
  다른 회원의 아이디는 넣지 않고 닉네임만 넣었어요.
- 압축을 모두 푼 뒤 열어야 사진이 보여요 (글 파일이 ../files/ 의 사진을 가리켜요).
- 이 파일에는 비공개 내용이 있을 수 있으니 다른 사람에게 보내기 전에 확인해 주세요.
`;
}
