import { recordBlogVisit, recordPostView } from "@/app/blog/actions";

// 블로그 홈 `👣 방문자`·글 상세 `👀 조회`를 화면이 열린 뒤 한 번 기록한다 (BLOG-06, POST-06).
// Server Action으로 부르면 처음 온 브라우저에 방문자 쿠키를 심을 때 Next가 화면 전체(RSC)를 다시 그려 보내서,
// 쿠키를 심어도 아무것도 다시 그리지 않는 Route Handler로 받는다. Origin 확인은 직접 한다 (NF-12).
//   { "blogId": 3 }                      → { stats: VisitStats | null }
//   { "postId": 7, "referrer": "https://…" } → { count: number | null }

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || origin === "null" || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "forbidden" }, { status: 403, headers: NO_STORE });
  const body: unknown = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) return Response.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
  const { blogId, postId, referrer } = body as Record<string, unknown>;
  if (postId !== undefined) return Response.json({ count: await recordPostView(String(postId), referrer ?? "") }, { headers: NO_STORE });
  if (blogId !== undefined) return Response.json({ stats: await recordBlogVisit(String(blogId)) }, { headers: NO_STORE });
  return Response.json({ error: "invalid" }, { status: 400, headers: NO_STORE });
}
