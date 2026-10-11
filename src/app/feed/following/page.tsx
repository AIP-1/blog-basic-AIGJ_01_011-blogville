import type { Metadata } from "next";
import Link from "next/link";
import { FeedView } from "@/components/feed/FeedView";
import { parsePage } from "@/lib/ids";
import { requireMember } from "@/server/dal";
import { listFeed } from "@/server/feed";
import { getPopularTags } from "@/server/tags";

export const metadata: Metadata = { title: "이웃 새 글 | Blogville" };

// 이웃 새 글 (SOC-04): 내가 이웃 추가한 블로그의 공개 글. 방문자는 첫 화면으로.
export default async function FollowingFeedPage({ searchParams }: PageProps<"/feed/following">) {
  const member = await requireMember();
  const page = parsePage((await searchParams).page);
  // 인기 태그는 이웃 글만이 아니라 마을 전체 공개 글의 태그다
  const [feed, tags] = await Promise.all([listFeed({ page, followerId: member.userId }), getPopularTags()]);
  return (
    <FeedView
      title="💛 이웃 새 글"
      tab="following"
      showFollowingTab
      feed={feed}
      page={page}
      tags={tags}
      empty={
        <>
          <p>아직 이웃이 없거나 이웃의 새 글이 없어요.</p>
          <p className="mt-1">
            <Link href="/feed" className="font-semibold text-accent underline">
              마을 소식
            </Link>
            에서 마음에 드는 블로그를 이웃으로 추가해 보세요.
          </p>
        </>
      }
    />
  );
}
