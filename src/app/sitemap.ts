import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/feed";
import { listSitemapEntries } from "@/server/post";

// 검색엔진용 /sitemap.xml: 첫 화면, 마을 소식, 모든 블로그 홈과 공개 글
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const { blogs, posts } = await listSitemapEntries();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/feed`, changeFrequency: "hourly", priority: 0.8 },
    ...blogs.map((b) => ({ url: `${base}/@${b.slug}`, lastModified: b.updatedAt, changeFrequency: "daily" as const, priority: 0.7 })),
    ...posts.map((p) => ({ url: `${base}/@${p.slug}/${p.id}`, lastModified: p.updatedAt, priority: 0.6 })),
  ];
}
