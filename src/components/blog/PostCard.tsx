import Link from "next/link";
import type { Post } from "@/db/schema";
import { excerpt, formatDate } from "@/lib/text";
import { CategoryBadge } from "../post/CategoryBadge";

type Props = {
  slug: string;
  post: Post;
  categoryName: string | null;
  subcategoryName: string | null;
  /** 여러 블로그의 글을 모아 보여 줄 때 (태그별 글) */
  blogTitle?: string;
  /** 삭제되지 않은 댓글 + 답글 (SOC-01·02) */
  commentCount?: number;
  /** 공감 수 (SOC-03), 0이어도 보인다 */
  likeCount?: number;
};

export function PostCard({ slug, post, categoryName, subcategoryName, blogTitle, commentCount = 0, likeCount = 0 }: Props) {
  return (
    <article>
      <Link href={`/@${slug}/${post.id}`} className="block rounded-xl border border-line bg-surface p-4 hover:border-accent">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge categoryName={categoryName} subcategoryName={subcategoryName} />
          {!post.isPublic && <span className="text-sm font-semibold text-ink-soft">🔒 비공개</span>}
        </div>
        <h2 className="mt-2 text-lg font-bold">{post.title}</h2>
        <p className="mt-1 line-clamp-2 text-ink-soft">{excerpt(post.contentText)}</p>
        <p className="mt-2 text-sm text-ink-soft">
          {blogTitle && `${blogTitle} · `}
          {formatDate(post.createdAt)}
          <span aria-label={`공감 ${likeCount}`}> · ♥ {likeCount}</span>
          {commentCount > 0 && <span aria-label={`댓글 ${commentCount}개`}> · 💬 {commentCount}</span>}
          <span aria-label={`조회 ${post.viewCount}`}> · 👀 {post.viewCount}</span>
        </p>
      </Link>
    </article>
  );
}
