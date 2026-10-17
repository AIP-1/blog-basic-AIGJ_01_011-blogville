import type { Metadata } from "next";
import Link from "next/link";
import { deleteBookmark } from "@/app/bookmarks/actions";
import { Pagination } from "@/components/blog/Pagination";
import { PageHeader } from "@/components/layout/PageHeader";
import { PostCard } from "@/components/blog/PostCard";
import { parsePage } from "@/lib/ids";
import { BOOKMARK_PAGE_SIZE } from "@/lib/report-rules";
import { loginHref } from "@/lib/safe-next";
import { listBookmarks } from "@/server/bookmarks";
import { getSession } from "@/server/dal";

export const metadata: Metadata = { title: "내 스크랩 | Blogville", robots: { index: false, follow: false } };

// 🔖 내 스크랩 (나중에 읽기, specs/059-report-bookmarks): 스크랩한 최신순, 한 쪽 10개.
// 지금 공개된 글만 보인다 (비공개가 된 글은 빠진다). 방문자에게는 로그인 링크.
export default async function BookmarksPage({ searchParams }: PageProps<"/bookmarks">) {
  const member = await getSession();
  if (!member) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <PageHeader emoji="🔖" title="내 스크랩" mark="bench" />
        <p className="rounded-2xl border border-line bg-surface p-5 text-ink-soft">
          <Link href={loginHref("/bookmarks")} className="inline-flex min-h-11 items-center font-semibold text-accent underline">
            로그인
          </Link>
          하면 스크랩한 글을 모아 볼 수 있어요
        </p>
      </div>
    );
  }
  const page = parsePage((await searchParams).page);
  const { items, total } = await listBookmarks(member.userId, page);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        emoji="🔖"
        title="내 스크랩"
        mark="bench"
        description={
          <>
            나중에 읽을 글 <span data-bookmark-total={total}>{total.toLocaleString("ko-KR")}개</span>
          </>
        }
      />
      {items.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-5 text-ink-soft">아직 스크랩한 글이 없어요. 글 아래 [🔖 스크랩]을 눌러 모아 보세요</p>
      ) : (
        <ul className="space-y-3">
          {items.map((b) => (
            <li key={b.post.id} data-bookmark-item={b.post.id}>
              <PostCard
                slug={b.slug}
                post={b.post}
                categoryName={b.categoryName}
                subcategoryName={b.subcategoryName}
                commentCount={b.commentCount}
                likeCount={b.likeCount}
                author={{ nickname: b.nickname ?? "", blogTitle: b.blogTitle }}
              />
              <form action={deleteBookmark} className="mt-1 flex justify-end">
                <input type="hidden" name="postId" value={b.post.id} />
                <button type="submit" className="btn btn-ghost px-2 text-sm text-ink-soft" aria-label={`'${b.post.title}' 스크랩 취소`}>
                  스크랩 취소
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <Pagination basePath="/bookmarks" query={{}} page={page} totalPages={Math.ceil(total / BOOKMARK_PAGE_SIZE)} />
    </div>
  );
}
