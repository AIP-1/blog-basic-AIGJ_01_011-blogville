import { parseId } from "./ids";

export const TITLE_MAX = 100;
export const CONTENT_HTML_MAX = 200_000;
/** 요청 크기 한도 (UTF-8 바이트). 넘으면 브라우저가 보내기 전에 막는다. */
export const CONTENT_BYTES_MAX = 900_000;

export const POST_ERRORS = {
  invalid: "잘못된 요청이에요",
  titleEmpty: "제목을 적어 주세요",
  titleTooLong: "제목은 100자까지예요",
  tooLong: "글이 너무 길어요",
  contentEmpty: "본문을 적어 주세요",
} as const;

export type Visibility = "public" | "private";

export type RawPostInput = {
  postId: string;
  title: string;
  contentHtml: string;
  categoryId: string;
  subcategoryId: string;
  visibility: string;
};

export type PostInput = {
  postId: number | null;
  title: string;
  contentHtml: string;
  categoryId: number | null;
  subcategoryId: number | null;
  isPublic: boolean;
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
  return {
    ok: true,
    value: { postId, title, contentHtml: raw.contentHtml, categoryId, subcategoryId, isPublic: raw.visibility === "public" },
  };
}

export function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}
