import Link from "next/link";
import type { Post } from "@/db/schema";
import { firstImageUrl, thumbUrl } from "@/lib/attachments";
import { scheduleLabel } from "@/lib/schedule";
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
  /** 마을 소식·이웃 새 글: 카드 위 작성자 줄 (누르면 그 블로그 홈) */
  author?: { nickname: string; blogTitle: string };
  /** 이웃 새 글 맨 위로 올라온 즐겨찾는 이웃의 글 (TOWN-08) */
  pinned?: boolean;
  /** 🔥 인기 글의 순위 (1부터) */
  rank?: number;
};

export function PostCard({ slug, post, categoryName, subcategoryName, blogTitle, commentCount = 0, likeCount = 0, author, pinned = false, rank }: Props) {
  // 대표 사진: 본문의 첫 사진 (비공개 글도 주인에게만 목록에 나오므로 그대로)
  const cover = firstImageUrl(post.contentHtml);
  return (
    <article>
      {author && (
        // 읽는 이름 = 보이는 글자 (Lighthouse label-content-name-mismatch). 사이 공백은 flex라 화면에 안 보인다
        <Link href={`/@${slug}`} className="flex min-h-11 min-w-0 items-center gap-1 px-1 text-sm">
          <span className="shrink-0 font-bold">{author.nickname}</span>{" "}
          <span className="min-w-0 truncate text-ink-soft">· {author.blogTitle}</span>
        </Link>
      )}
      <Link href={`/@${slug}/${post.id}`} className="flex gap-4 rounded-xl border border-line bg-surface p-4 hover:border-accent">
        {rank !== undefined && (
          <span className={`min-w-9 shrink-0 whitespace-nowrap text-center text-2xl font-extrabold tabular-nums ${rank <= 3 ? "text-accent" : "text-ink-soft"}`} data-popular-rank={rank}>
            {rank}
            <span className="sr-only">위</span>
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {pinned && <span className="notice-yellow rounded-full px-2 py-0.5 text-sm font-semibold">⭐ 즐겨찾는 이웃</span>}
            <CategoryBadge categoryName={categoryName} subcategoryName={subcategoryName} />
            {!post.isPublic && (
              <span className="text-sm font-semibold text-ink-soft">{post.publishAt ? `⏰ ${scheduleLabel(post.publishAt)} 공개 예약` : "🔒 비공개"}</span>
            )}
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
        </div>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element -- 우리 저장소(/files) 사진, 크기를 모른다
          <img src={thumbUrl(cover, 320)} alt="" loading="lazy" className="size-20 shrink-0 self-center rounded-lg border border-line object-cover sm:size-24" data-post-cover />
        )}
      </Link>
    </article>
  );
}
