import type { Metadata } from "next";
import Link from "next/link";
import { PostCard } from "@/components/blog/PostCard";
import { parsePopularRange, POPULAR_LIMIT, POPULAR_RANGE_INFO, POPULAR_RANGES, DEFAULT_POPULAR_RANGE } from "@/lib/popular";
import { listPopular } from "@/server/popular";

export const metadata: Metadata = {
  title: "🔥 인기 글 | Blogville",
  description: "Blogville 마을에서 요즘 많이 읽히고 공감받는 글",
};

// 🔥 인기 글: 마을 전체 공개 글을 기간(오늘·이번 주·이번 달)별 점수 순으로. 로그인 필요 없음
export default async function PopularPage({ searchParams }: PageProps<"/popular">) {
  const range = parsePopularRange((await searchParams).range);
  const items = await listPopular(range);
  const info = POPULAR_RANGE_INFO[range];
  return (
    <section aria-labelledby="popular-title" className="mx-auto max-w-3xl min-w-0">
      <h1 id="popular-title" className="text-2xl font-extrabold">
        🔥 인기 글
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        {info.hint} 동안 많이 읽히고 공감·댓글을 받은 글 {POPULAR_LIMIT}개 (조회 + 공감 ×3 + 댓글 ×2)
      </p>
      <nav aria-label="인기 글 기간" className="mt-3 flex flex-wrap gap-2">
        {POPULAR_RANGES.map((key) => (
          <Link
            key={key}
            href={key === DEFAULT_POPULAR_RANGE ? "/popular" : `/popular?range=${key}`}
            aria-current={key === range ? "page" : undefined}
            className={`btn ${key === range ? "btn-current" : ""}`}
          >
            {POPULAR_RANGE_INFO[key].label}
          </Link>
        ))}
        <Link href="/feed" className="btn btn-ghost ml-auto">
          📋 마을 소식
        </Link>
      </nav>
      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">
          <p>{info.label} 아직 인기 글이 없어요. 마을 소식에서 글을 읽고 공감을 눌러 보세요! ♥</p>
        </div>
      ) : (
        <ol className="mt-4 space-y-3" data-popular-list={range}>
          {items.map((row, i) => (
            <li key={row.post.id} data-popular-post={row.post.id}>
              <PostCard
                slug={row.blogSlug}
                post={row.post}
                categoryName={row.categoryName}
                subcategoryName={row.subcategoryName}
                commentCount={row.commentCount}
                likeCount={row.likeCount}
                author={{ nickname: row.nickname, blogTitle: row.blogTitle }}
                rank={i + 1}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
