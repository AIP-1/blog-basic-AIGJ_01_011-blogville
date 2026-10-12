import { parseId } from "./ids";

export const TITLE_MAX = 100;
export const CONTENT_HTML_MAX = 200_000;
/** 요청 크기 한도 (UTF-8 바이트). 넘으면 브라우저가 보내기 전에 막는다. */
export const CONTENT_BYTES_MAX = 900_000;
/** 태그 칸 전체 (POST-04) */
export const TAGS_MAX_CHARS = 300;
export const TAG_MAX_LENGTH = 20;
export const TAGS_PER_POST = 10;

export const POST_ERRORS = {
  invalid: "잘못된 요청이에요",
  titleEmpty: "제목을 적어 주세요",
  titleTooLong: "제목은 100자까지예요",
  tooLong: "글이 너무 길어요",
  contentEmpty: "본문을 적어 주세요",
  tagsTooLong: "태그는 모두 합쳐 300자까지예요",
} as const;

export type Visibility = "public" | "private";

export type RawPostInput = {
  postId: string;
  title: string;
  contentHtml: string;
  categoryId: string;
  subcategoryId: string;
  visibility: string;
  tags: string;
};

export type PostInput = {
  postId: number | null;
  title: string;
  contentHtml: string;
  categoryId: number | null;
  subcategoryId: number | null;
  isPublic: boolean;
  tags: string[];
};

export function rawPostInput(formData: FormData): RawPostInput {
  const get = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  return {
    postId: get("postId"),
    title: get("title"),
    contentHtml: get("contentHtml"),
    categoryId: get("categoryId"),
    subcategoryId: get("subcategoryId"),
    // 값을 아예 보내지 않으면 공개로 본다 (POST-02)
    visibility: get("visibility") || "public",
    tags: get("tags"),
  };
}

const optionalId = (value: string): number | null | undefined =>
  value === "" ? null : (parseId(value) ?? undefined);

/**
 * 검사 순서 = 문구 순서 (contracts/server-actions.md savePost ①~⑦).
 * ⑦ 정화한 본문이 비었는지·⑧ 카테고리 소속은 서버가 따로 본다.
 */
export function checkPostInput(raw: RawPostInput): { ok: true; value: PostInput } | { ok: false; error: string } {
  const postId = optionalId(raw.postId);
  if (postId === undefined) return { ok: false, error: POST_ERRORS.invalid };
  const title = raw.title.trim();
  if (title.length === 0) return { ok: false, error: POST_ERRORS.titleEmpty };
  if (title.length > TITLE_MAX) return { ok: false, error: POST_ERRORS.titleTooLong };
  if (raw.contentHtml.length > CONTENT_HTML_MAX) return { ok: false, error: POST_ERRORS.tooLong };
  const categoryId = optionalId(raw.categoryId);
  const subcategoryId = optionalId(raw.subcategoryId);
  if (categoryId === undefined || subcategoryId === undefined) return { ok: false, error: POST_ERRORS.invalid };
  if (raw.visibility !== "public" && raw.visibility !== "private") return { ok: false, error: POST_ERRORS.invalid };
  if (subcategoryId !== null && categoryId === null) return { ok: false, error: POST_ERRORS.invalid };
  if (raw.tags.length > TAGS_MAX_CHARS) return { ok: false, error: POST_ERRORS.tagsTooLong };
  return {
    ok: true,
    value: {
      postId,
      title,
      contentHtml: raw.contentHtml,
      categoryId,
      subcategoryId,
      isPublic: raw.visibility === "public",
      tags: parseTags(raw.tags),
    },
  };
}

/**
 * 태그 칸 → 태그 목록 (POST-04). 규칙에 안 맞는 태그는 문구 없이 버린다.
 * 나누기(`,` `#` 줄바꿈) → 공백 정리·소문자 → 빈 것·20자 초과 버리기 → 중복 제거 → 앞 10개.
 */
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,#\r\n]/)) {
    const tag = part.trim().replace(/\s+/g, " ").toLowerCase();
    // 글자 수는 JS length 기준 (이모지 = 2자, 명세 그대로)
    if (tag.length === 0 || tag.length > TAG_MAX_LENGTH) continue;
    seen.add(tag);
    if (seen.size === TAGS_PER_POST) break;
  }
  return [...seen];
}

export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

export const LINK_ERROR = "링크로 넣을 수 없는 주소예요. https://로 시작하는 주소를 넣어 주세요.";

/** 링크로 남는 주소의 scheme (POST-01: 저장할 때 http·https·mailto와 `/…`만 남는다) */
const LINK_SCHEMES = new Set(["http", "https", "mailto"]);

/**
 * 링크 창에 넣은 값 (POST-01). `""`는 링크 풀기, null은 저장하면 사라지거나 엉뚱한 곳으로 가는 주소.
 * `naver.com`처럼 scheme 없이 넣으면 `https://`를 붙인다 (그대로 두면 글 주소 기준 상대 주소가 되어 404).
 */
export function linkHref(input: string): string | null {
  const href = input.trim();
  if (href === "" || /^https?:\/\/$/i.test(href)) return "";
  if (/\s/.test(href)) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1];
  // naver.com:8080처럼 점이 있으면 scheme이 아니라 주소다
  if (scheme && !scheme.includes(".")) return LINK_SCHEMES.has(scheme.toLowerCase()) ? href : null;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return href;
  return /^[^/?#]+\.[^/?#]+/.test(href) ? `https://${href}` : null;
}
