import { ATTACH_MESSAGES, attachmentAccess, contentDisposition, KEY_PATTERN } from "@/lib/attachments";
import { findReadableAttachment } from "@/server/attachments";
import { getSession } from "@/server/dal";
import { openFile } from "@/server/storage";

// 첨부 보기·내려받기 (FR-007·008). 권한을 매번 확인한다 (304도 확인한 뒤에만).

const notFound = () =>
  new Response(ATTACH_MESSAGES.notFound, {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-cache" },
  });

export async function GET(req: Request, ctx: RouteContext<"/files/[key]">) {
  const { key } = await ctx.params;
  if (!KEY_PATTERN.test(key)) return notFound();
  const a = await findReadableAttachment(key);
  if (!a) return notFound();
  // 공개 글의 첨부는 세션을 읽지 않는다
  const viewerId = a.postId !== null && a.postIsPublic ? null : ((await getSession())?.userId ?? null);
  if (!attachmentAccess(a, viewerId)) return notFound();

  // 누구나 볼 수 있는 첨부: 공개 글의 첨부와 프로필 사진
  const isPublicFile = a.postId !== null ? a.postIsPublic === true : a.isProfilePhoto;
  const etag = `"${a.key}"`;
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    // sandbox는 브라우저가 열어 보여 주는 사진에만. 내려받는 파일에 붙이면 Chrome이 원래 이름을 버린다.
    "Content-Security-Policy": `default-src 'none'; img-src 'self'; media-src 'self'${a.kind === "image" ? "; sandbox" : ""}`,
    // 공개 글의 첨부는 브라우저가 하루 동안 다시 묻지 않고 쓴다 (파일 키가 무작위라 같은 키의 내용은 바뀌지 않는다).
    // 비공개로 바꾼 글의 사진이 남의 브라우저에 오래 남지 않게 하루로 둔다. 나머지는 매번 권한을 확인한다.
    "Cache-Control": isPublicFile ? "public, max-age=86400" : "private, no-cache",
    ETag: etag,
  };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

  const file = await openFile(a.key);
  if (!file) return notFound();
  return new Response(file.stream, {
    headers: {
      ...headers,
      "Content-Type": a.mime,
      "Content-Length": String(file.size),
      "Content-Disposition": contentDisposition(a.kind, a.name),
    },
  });
}
