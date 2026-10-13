import { exportFileName, waitMinutes } from "@/lib/export";
import { getMyBlog, getSession } from "@/server/dal";
import { claimExport, exportBlogStream } from "@/server/export";

// 내 블로그 내보내기 (.zip 백업). 블로그 관리의 [내 블로그 내려받기] 링크가 연다.
// 로그인한 회원 자기 블로그만 내보낸다. 비로그인이거나 ?blog= 주소가 내 블로그가 아니면 404.

const notFound = () =>
  new Response("찾을 수 없어요", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const member = await getSession();
  if (!member) return notFound();
  const blog = await getMyBlog(member.userId);
  const asked = new URL(req.url).searchParams.get("blog");
  if (asked !== null && asked !== blog.slug) return notFound();

  // 10분에 한 번: 블로그 관리 화면으로 돌려보내 안내를 띄운다
  const wait = claimExport(member.userId);
  if (wait > 0) {
    return new Response(null, {
      status: 303,
      headers: { Location: `/settings/blog?export=wait&min=${waitMinutes(wait)}#export`, "Cache-Control": "no-store" },
    });
  }

  const stream = await exportBlogStream(blog);
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${exportFileName(blog.slug)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
