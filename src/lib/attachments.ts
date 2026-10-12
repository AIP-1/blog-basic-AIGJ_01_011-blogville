// 첨부 규칙 (POST-07·09). 브라우저와 서버가 같이 쓴다.

export type AttachmentKind = "image" | "file";

export const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export const FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  hwp: "application/x-hwp",
  hwpx: "application/hwp+zip",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  key: "application/vnd.apple.keynote",
  zip: "application/zip",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  json: "application/json",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
};

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const FILE_MAX_BYTES = 30 * 1024 * 1024;
/** 요청 전체 한도. 넘으면 본문을 읽기 전에 거절한다 (multipart 머리 여유 1MB) */
export const REQUEST_MAX_BYTES = 31 * 1024 * 1024;
export const NAME_MAX = 255;

export const ATTACH_MESSAGES = {
  badType:
    "올릴 수 없는 형식이에요. 사진은 PNG·JPG·GIF·WEBP, 파일은 PDF·한글·워드·엑셀·파워포인트·키노트·ZIP·TXT·CSV·MD·JSON·MP3·MP4만 올릴 수 있어요",
  notImage: "사진 파일이 아니에요. PNG·JPG·GIF·WEBP 사진만 올릴 수 있어요",
  imageTooBig: "사진은 10MB까지 올릴 수 있어요",
  fileTooBig: "파일은 30MB까지 올릴 수 있어요",
  empty: "빈 파일은 올릴 수 없어요",
  failed: "올리지 못했어요. 다시 시도해 주세요",
  busy: "다른 파일을 올리는 중이에요. 끝난 뒤 다시 넣어 주세요",
  login: "로그인한 회원만 올릴 수 있어요",
  invalid: "잘못된 요청이에요",
  notFound: "파일을 찾을 수 없어요",
} as const;

export const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).map((e) => `.${e}`).join(",");
export const FILE_ACCEPT = [...Object.keys(IMAGE_TYPES), ...Object.keys(FILE_TYPES)].map((e) => `.${e}`).join(",");

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** 확장자로 종류와 형식을 정한다. 받지 않는 형식이면 null. */
export function typeOf(name: string): { kind: AttachmentKind; mime: string; ext: string } | null {
  const ext = extensionOf(name);
  if (IMAGE_TYPES[ext]) return { kind: "image", mime: IMAGE_TYPES[ext], ext };
  if (FILE_TYPES[ext]) return { kind: "file", mime: FILE_TYPES[ext], ext };
  return null;
}

/** 이름·크기만 보고 문제를 찾는다 (브라우저가 먼저, 서버가 다시). 문제없으면 null. */
export function attachmentProblem(name: string, size: number): string | null {
  const type = typeOf(name);
  if (!type) return ATTACH_MESSAGES.badType;
  if (size === 0) return ATTACH_MESSAGES.empty;
  if (type.kind === "image" && size > IMAGE_MAX_BYTES) return ATTACH_MESSAGES.imageTooBig;
  if (type.kind === "file" && size > FILE_MAX_BYTES) return ATTACH_MESSAGES.fileTooBig;
  return null;
}

/** 파일 앞부분이 확장자의 사진 형식과 맞는지 (SVG·HTML을 .png로 바꾼 것 막기) */
export function sniffImage(ext: string, head: Uint8Array): boolean {
  const starts = (bytes: number[], at = 0) => bytes.every((b, i) => head[at + i] === b);
  switch (ext) {
    case "png":
      return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg":
      return starts([0xff, 0xd8, 0xff]);
    case "gif":
      return starts([0x47, 0x49, 0x46, 0x38]);
    case "webp":
      return starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8);
    default:
      return false;
  }
}

/** 원래 이름 정리: 경로·제어 문자를 빼고, 255자가 넘으면 확장자를 남기고 줄인다. */
export function cleanFileName(raw: string): string {
  const base = raw.split(/[/\\]/).pop()!.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  const chars = [...base];
  if (chars.length <= NAME_MAX) return base;
  const ext = extensionOf(base);
  const tail = ext ? `.${ext}` : "";
  return chars.slice(0, NAME_MAX - [...tail].length).join("") + tail;
}

/** `45B`, `340KB`, `1.2MB` */
export function formatBytes(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)}KB`;
  return `${(size / 1024 / 1024).toFixed(1)}MB`;
}

/** 내려받기 이름 (RFC 6266·8187). 한글·따옴표·괄호도 그대로 저장되게 한다. */
export function contentDisposition(kind: AttachmentKind, name: string): string {
  if (kind === "image") return "inline";
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

/** 파일 카드 아이콘 */
export function fileIcon(ext: string): string {
  if (ext === "pdf") return "📕";
  if (ext === "hwp" || ext === "hwpx") return "📘";
  if (ext === "doc" || ext === "docx") return "📝";
  if (ext === "xls" || ext === "xlsx" || ext === "csv") return "📊";
  if (ext === "ppt" || ext === "pptx" || ext === "key") return "📽️";
  if (ext === "zip") return "🗜️";
  if (ext === "mp3") return "🎵";
  if (ext === "mp4") return "🎬";
  return "📄";
}

export const KEY_PATTERN = /^[0-9a-f]{32}$/;
const FILE_URL = /^\/files\/([0-9a-f]{32})$/;

/** `/files/키` 주소면 키, 아니면 null */
export function keyFromUrl(url: string | undefined): string | null {
  return url ? (FILE_URL.exec(url)?.[1] ?? null) : null;
}

/** 본문 HTML에 나온 `/files/키`를 모두 (중복 없이, 정렬해서 → 잠그는 순서) */
export function extractFileKeys(html: string): string[] {
  const keys = new Set<string>();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']?\/files\/([0-9a-f]{32})["'\s>]/gi)) keys.add(m[1]);
  return [...keys].sort();
}

/**
 * 누가 여나 (FR-007): 공개 글은 누구나, 비공개 글은 블로그 주인만, 붙지 않은 첨부는 올린 사람만.
 * 지금 누군가의 프로필 사진인 첨부(글에는 붙지 않는다)는 누구나 본다 (BLOG-04). 관리자도 예외가 아니다.
 */
export function attachmentAccess(
  a: { uploaderId: string; postId: number | null; postIsPublic: boolean | null; blogOwnerId: string | null; isProfilePhoto: boolean },
  viewerId: string | null,
): boolean {
  if (a.postId === null) return a.isProfilePhoto || (viewerId !== null && viewerId === a.uploaderId);
  if (a.postIsPublic) return true;
  return viewerId !== null && viewerId === a.blogOwnerId;
}

/** 붙여 넣은 첨부 처리 (POST-07 흐름 7): 그대로 넣기 / 새로 다시 올려 넣기 / 넣지 않기 */
export type PasteAction = "keep" | "reupload" | "drop";

/** 붙여 넣기에서 한 번에 확인하는 키 수 */
export const PASTE_KEYS_MAX = 50;

/**
 * 내 것이고 안 붙었거나 이 글 것이면 keep, 내 것인데 다른 글에 붙었거나 내 프로필 사진이면 reupload,
 * 남의 것·없는 키는 drop. `editingPostId`는 수정 중인 글(새 글이면 null).
 */
export function pasteAction(
  a: { uploaderId: string; postId: number | null; isProfilePhoto?: boolean } | undefined,
  viewerId: string,
  editingPostId: number | null,
): PasteAction {
  if (!a || a.uploaderId !== viewerId) return "drop";
  if (a.isProfilePhoto) return "reupload";
  if (a.postId === null || a.postId === editingPostId) return "keep";
  return "reupload";
}
