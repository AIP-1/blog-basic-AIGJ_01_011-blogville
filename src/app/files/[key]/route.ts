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

  const etag = `"${a.key}"`;
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    // sandbox는 브라우저가 열어 보여 주는 사진에만. 내려받는 파일에 붙이면 Chrome이 원래 이름을 버린다.
    "Content-Security-Policy": `default-src 'none'; img-src 'self'; media-src 'self'${a.kind === "image" ? "; sandbox" : ""}`,
    "Cache-Control": "private, no-cache",
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
