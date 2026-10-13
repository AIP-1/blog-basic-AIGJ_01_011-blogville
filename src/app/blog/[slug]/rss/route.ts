import { buildRss, siteUrl } from "@/lib/feed";
import { getBlogBySlug } from "@/server/blog";
import { listFeedPosts } from "@/server/post";

// 블로그 구독 주소 /@주소/rss (next.config.ts rewrite). 최신 공개 글 20개, 본문 전체.
export async function GET(_req: Request, ctx: RouteContext<"/blog/[slug]/rss">) {
  const { slug } = await ctx.params;
  const found = await getBlogBySlug(slug);
  if (!found) return new Response("없는 블로그예요", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const items = await listFeedPosts(found.blog.id);
  const xml = buildRss({ slug: found.blog.slug, title: found.blog.title, intro: found.blog.intro, nickname: found.nickname }, items, siteUrl());
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
