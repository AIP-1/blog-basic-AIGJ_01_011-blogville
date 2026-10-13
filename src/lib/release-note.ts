// 릴리스 노트(docs/releases/v<버전>.md)를 공지 블로그 글 HTML로 바꾼다.
// 우리가 쓰는 마크다운만 다룬다: 제목(##, ###), 문단, 목록(-, 1.), 표, 그림, **굵게**, `코드`, [링크](주소).
// 글 화면이 허용하는 태그(sanitize.ts)만 만든다. 표는 허용 태그가 아니라서 목록이나 그림 묶음으로 바꾼다.

export type ReleaseNote = { version: string; title: string; markdown: string };

export type NoteLinks = {
  /** 노트 안의 그림 상대 경로(img/v1.0.0/a.png) → 글에 넣을 주소. null이면 그림을 뺀다 */
  image: (relPath: string) => string | null;
  /** 노트 안의 상대 링크(../../CONTRIBUTING.md) → 절대 주소 */
  link: (relPath: string) => string;
};

const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;

/** 버전 비교 (1.10.0 > 1.9.0) */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

/** 파일 이름 v1.2.3.md → 1.2.3 */
export function versionOfFile(name: string): string | null {
  return /^v(\d+\.\d+\.\d+)\.md$/.exec(name)?.[1] ?? null;
}

/** 첫 줄 `# 제목`을 글 제목으로 (100자까지) */
export function noteTitle(markdown: string, version: string): string {
  const first = markdown.split("\n").find((l) => l.trim());
  const title = first?.startsWith("# ") ? first.slice(2).trim() : `Blogville v${version}`;
  return title.slice(0, 100);
}

/** 노트에 쓰인 그림 상대 경로 (중복 없이, 나온 순서대로) */
export function imagePaths(markdown: string): string[] {
  const found = [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((p) => !/^[a-z]+:/i.test(p));
  return [...new Set(found)];
}

function inline(text: string, links: NoteLinks): string {
  // 코드 조각은 먼저 빼 두어 안의 ** 같은 글자를 건드리지 않는다
  const codes: string[] = [];
  let s = text.replace(/`([^`]+)`/g, (_, c: string) => {
    codes.push(`<code>${esc(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
    const url = /^(https?:|mailto:)/.test(href) ? href : links.link(href);
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
  });
  s = s.replace(/https?:\/\/[^\s<]+/g, (url, offset: number, all: string) => (all[offset - 1] === '"' || all[offset - 1] === ">" ? url : `<a href="${url}" target="_blank" rel="noopener noreferrer nofollow">${url}</a>`));
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]);
}

function imageHtml(cell: string, links: NoteLinks): string | null {
  const m = IMAGE.exec(cell.trim());
  if (!m) return null;
  const src = links.image(m[2]);
  return src ? `<p><img src="${esc(src)}" alt=""></p>` : null;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

function tableHtml(rows: string[], links: NoteLinks): string {
  const [head, , ...body] = rows.map(cells);
  const hasImages = body.some((r) => r.some((c) => IMAGE.test(c)));
  if (hasImages) {
    // 그림 표: 칸마다 머리글을 굵게 쓰고 그 아래 그림
    const out: string[] = [];
    for (const row of body) {
      row.forEach((c, i) => {
        const img = imageHtml(c, links);
        if (!img) return;
        if (head[i]) out.push(`<p><strong>${inline(head[i], links)}</strong></p>`);
        out.push(img);
      });
    }
    return out.join("");
  }
  // 글 표: 줄마다 첫 칸을 굵게, 나머지를 · 로 잇는다
  const items = body.map((r) => {
    const [first, ...rest] = r;
    const tail = rest.filter(Boolean).map((c) => inline(c, links)).join(" · ");
    return `<li><strong>${inline(first, links)}</strong>${tail ? ` ${tail}` : ""}</li>`;
  });
  return `<ul>${items.join("")}</ul>`;
}

/** 노트 → 글 HTML. 첫 줄 `# 제목`은 글 제목이 되므로 뺀다 */
export function noteToHtml(markdown: string, links: NoteLinks): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  if (lines[0]?.startsWith("# ")) lines.shift();
  const out: string[] = [];
  let para: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;
  let table: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "), links)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i, links)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };
  const flushTable = () => {
    if (table.length >= 2) out.push(tableHtml(table, links));
    table = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().startsWith("|")) {
      flushPara();
      flushList();
      table.push(line);
      continue;
    }
    flushTable();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const tag = heading[1].length === 2 ? "h2" : "h3";
      out.push(`<${tag}>${inline(heading[2], links)}</${tag}>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flushAll();
      out.push("<hr>");
      continue;
    }
    const img = imageHtml(line, links);
    if (img) {
      flushAll();
      out.push(img);
      continue;
    }
    const bullet = /^\s*-\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushPara();
      const tag = bullet ? "ul" : "ol";
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    if (list) {
      // 목록 항목이 다음 줄로 이어진 경우
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}

/** 검색·요약에 쓰는 글자만 */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replace(/\s+/g, " ")
    .trim();
}
