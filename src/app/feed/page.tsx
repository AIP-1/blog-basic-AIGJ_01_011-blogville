import type { Metadata } from "next";
import { BlogBrowse } from "@/components/feed/BlogBrowse";
import { FeedView } from "@/components/feed/FeedView";
import { parsePage } from "@/lib/ids";
import { getSession } from "@/server/dal";
import { listActiveBlogs, listFeed } from "@/server/feed";
import { getPopularTags } from "@/server/tags";

export const metadata: Metadata = { title: "마을 소식 | Blogville" };

// 마을 소식 (SOC-05): 모든 블로그의 공개 글. 로그인 필요 없음. 1페이지 맨 위에는 블로그 둘러보기.
export default async function FeedPage({ searchParams }: PageProps<"/feed">) {
  const page = parsePage((await searchParams).page);
  const [member, feed, tags, blogs] = await Promise.all([getSession(), listFeed({ page }), getPopularTags(), page === 1 ? listActiveBlogs() : []]);
  return (
    <FeedView
      title="📋 마을 소식"
      tab="all"
      showFollowingTab={member !== null}
      feed={feed}
      page={page}
      tags={tags}
      top={page === 1 && <BlogBrowse blogs={blogs} />}
      empty={<p>아직 마을에 글이 없어요. 첫 글의 주인공이 되어 보세요! ✏️</p>}
    />
  );
}
