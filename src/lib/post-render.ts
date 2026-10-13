import "server-only";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import sanitizeHtml from "sanitize-html";
import { addHeadingIds, innerText, type TocItem } from "./reader";

// 자주 쓰는 언어만 등록한다 (전체를 넣으면 무겁다). 글에는 언어 표시가 없어 자동으로 고른다.
const LANGUAGES = { bash, c, cpp, css, java, javascript, json, kotlin, python, sql, typescript, xml, yaml };
for (const [name, lang] of Object.entries(LANGUAGES)) {
  if (!hljs.getLanguage(name)) hljs.registerLanguage(name, lang);
}

/** 이보다 확신이 낮으면(짧은 글귀 등) 색을 칠하지 않는다 */
const MIN_RELEVANCE = 3;

/** 코드 글자 → 색칠한 HTML. highlight.js는 글자를 이스케이프하고 <span class="hljs-…">만 만든다. */
export function highlightCode(code: string): string {
  const result = hljs.highlightAuto(code);
  if (!result.language || result.relevance < MIN_RELEVANCE) return escapeText(code);
  return result.value;
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 보여 줄 때 한 번 더 거르는 허용 목록: 저장 때 목록(sanitize.ts) + 소제목 id + 코드 색칠 span.
 * 렌더 때 바꾼 결과도 이 목록을 통과한 것만 내보낸다 (NF-03).
 */
const RENDER_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "h2", "h3", "strong", "em", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "a", "hr", "img", "span"],
  allowedAttributes: {
    a: ["href", "target", "rel", "data-file", "data-name", "data-size", "data-size-label", "data-ext", "aria-label"],
    img: ["src", "alt"],
    h2: ["id"],
    h3: ["id"],
    code: ["class"],
    span: ["class"],
  },
  allowedClasses: {
    code: ["hljs"],
    // hljs-keyword, hljs-title, 그리고 hljs-title 뒤에 붙는 function_·class_ 같은 보조 이름
    span: [/^hljs-[a-z-]+$/, /^[a-z]+_+$/],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

/** 코드 블록 오른쪽 위 [복사] (글자는 고정, 동작은 PostBody가 맡는다) */
const COPY_BUTTON = '<button type="button" class="code-copy" data-copy-code>복사</button>';

export type RenderedPost = { html: string; toc: TocItem[] };

/**
 * 저장된(정화된) 본문을 보여 줄 HTML로: 소제목 id, 코드 색칠, 다시 정화, 코드 블록에 [복사].
 * DB 값은 바꾸지 않는다.
 */
export function renderPostHtml(saved: string): RenderedPost {
  const { html: withIds, toc } = addHeadingIds(saved);
  const highlighted = withIds.replace(/<pre>\s*<code>([\s\S]*?)<\/code>\s*<\/pre>/g, (_whole, inner: string) => {
    return `<pre><code class="hljs">${highlightCode(innerText(inner))}</code></pre>`;
  });
  const clean = sanitizeHtml(highlighted, RENDER_OPTIONS);
  // 정화를 통과한 <pre>…</pre>를 감싸고 고정 버튼을 붙인다 (사용자 글자는 끼어들지 않는다)
  const html = clean.replace(/<pre>([\s\S]*?)<\/pre>/g, (pre) => `<div class="code-block">${pre}${COPY_BUTTON}</div>`);
  return { html, toc };
}
