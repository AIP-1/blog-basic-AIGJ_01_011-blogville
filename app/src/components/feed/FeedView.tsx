import Link from "next/link";
import type { ReactNode } from "react";
import { Pagination } from "@/components/blog/Pagination";
import { PopularTags } from "@/components/blog/PopularTags";
import { PostCard } from "@/components/blog/PostCard";
import { PAGE_SIZE } from "@/server/post";
import type { listFeed } from "@/server/feed";

type Props = {
  title: string;
  tab: "all" | "following";
  /** 회원에게만 [💛 이웃 새 글] 탭이 보인다 */
  showFollowingTab: boolean;
  feed: Awaited<ReturnType<typeof listFeed>>;
  page: number;
  tags: { name: string; count: number }[];
  empty: ReactNode;
  /** 탭 아래·글 카드 위 (이웃 새 글의 내 이웃 목록) */
  top?: ReactNode;
};

const TABS = [
  { key: "all", href: "/feed", label: "🏘 마을 전체" },
  { key: "following", href: "/feed/following", label: "💛 이웃 새 글" },
] as const;

/** 마을 소식(SOC-05)과 이웃 새 글(SOC-04)이 같이 쓰는 화면: 탭 + 글 카드 + 인기 태그 */
export function FeedView({ title, tab, showFollowingTab, feed, page, tags, empty, top }: Props) {
  const basePath = tab === "all" ? "/feed" : "/feed/following";
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
      <section aria-labelledby="feed-title" className="min-w-0">
        <h1 id="feed-title" className="text-2xl font-extrabold">
          {title}
        </h1>
        <nav aria-label="소식 탭" className="mt-3 flex flex-wrap gap-2">
          {TABS.filter((t) => t.key === "all" || showFollowingTab).map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={t.key === tab ? "page" : undefined}
              className={`btn ${t.key === tab ? "btn-current" : ""}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {top}
        {feed.items.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">{empty}</div>
        ) : (
          <div className="mt-4 space-y-3">
            {feed.items.map((row) => (
              <PostCard
                key={row.post.id}
                slug={row.blogSlug}
                post={row.post}
                categoryName={row.categoryName}
                subcategoryName={row.subcategoryName}
                commentCount={row.commentCount}
                likeCount={row.likeCount}
                author={{ nickname: row.nickname, blogTitle: row.blogTitle }}
                pinned={row.pinned}
              />
            ))}
          </div>
        )}
        <Pagination basePath={basePath} query={{}} page={page} totalPages={Math.ceil(feed.total / PAGE_SIZE)} />
      </section>
      <aside className="min-w-0 md:sticky md:top-4 md:self-start">
        <PopularTags tags={tags} />
      </aside>
    </div>
  );
}
