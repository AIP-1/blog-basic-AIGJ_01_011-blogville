import Link from "next/link";
import { Pagination } from "@/components/blog/Pagination";
import { CommentRowDelete } from "@/components/settings/CommentRowDelete";
import { formatDateTime } from "@/lib/comment-rules";
import { parsePage } from "@/lib/ids";
import { excerpt } from "@/lib/text";
import { listBlogComments, MANAGE_COMMENTS_PAGE_SIZE } from "@/server/comments";
import { getMyBlog, requireMember } from "@/server/dal";

export const metadata = { title: "댓글 관리 | Blogville" };

/**
 * 댓글 관리 (SOC-01 열린 질문): 주인만. 내 글(비공개 포함)에 달린 댓글·답글을 최신순으로 모아 보고 바로 지운다.
 * 지우면 글 상세의 그 자리는 `삭제된 댓글이에요`가 된다. 주소: `?page=`
 */
export default async function ManageCommentsPage({ searchParams }: PageProps<"/settings/comments">) {
  const member = await requireMember();
  const blog = await getMyBlog(member.userId);
  const page = parsePage((await searchParams).page);
  const { items, total } = await listBlogComments(blog.id, page);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">💬 댓글 관리</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/posts" className="btn">
            📝 글 관리
          </Link>
          <Link href={`/@${blog.slug}`} className="btn">
            내 블로그로 →
          </Link>
        </div>
      </div>

      <section aria-labelledby="comments-title" className="rounded-2xl border border-line bg-surface">
        <h2 id="comments-title" className="border-b border-line px-4 py-3 font-bold">
          내 글에 달린 댓글 {total}개
        </h2>
        {items.length === 0 ? (
          <p className="p-8 text-center text-ink-soft">{total === 0 ? "아직 달린 댓글이 없어요" : "이 페이지에는 댓글이 없어요"}</p>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((c) => {
              const who = c.nickname ?? "알 수 없음";
              return (
                <li key={`${c.kind}-${c.id}`} data-comment={`${c.kind}-${c.id}`} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink-soft">
                      {c.kind === "reply" && <span>↳ 답글</span>}
                      {c.authorSlug ? (
                        <Link href={`/@${c.authorSlug}`} className="inline-flex min-h-11 items-center font-bold text-ink">
                          {who}
                        </Link>
                      ) : (
                        <span className="font-bold">{who}</span>
                      )}
                      <time dateTime={c.createdAt.toISOString()}>{formatDateTime(c.createdAt)}</time>
                    </p>
                    {/* 글자로만 보여 준다 (HTML로 넣지 않음, NF-03) */}
                    <p className="truncate">{excerpt(c.content, 80)}</p>
                    <Link href={`/@${blog.slug}/${c.postId}#${c.kind}-${c.id}`} className="inline-flex min-h-11 max-w-full items-center text-sm text-ink-soft hover:text-accent">
                      <span className="truncate">📄 {c.postTitle}</span>
                    </Link>
                  </div>
                  <CommentRowDelete kind={c.kind} id={c.id} label={`${who}의 ${c.kind === "reply" ? "답글" : "댓글"} 삭제`} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <Pagination basePath="/settings/comments" query={{}} page={page} totalPages={Math.ceil(total / MANAGE_COMMENTS_PAGE_SIZE)} />
    </div>
  );
}
