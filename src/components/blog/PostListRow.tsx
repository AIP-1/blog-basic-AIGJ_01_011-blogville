import Link from "next/link";
import type { Post } from "@/db/schema";
import { firstImageUrl } from "@/lib/attachments";
import { scheduleLabel } from "@/lib/schedule";
import { formatDate } from "@/lib/text";

type Props = { slug: string; post: Post; commentCount?: number; likeCount?: number };

/** 목록형: 제목·날짜·공감·댓글을 한 줄로 (블로그 꾸미기) */
export function PostListRow({ slug, post, commentCount = 0, likeCount = 0 }: Props) {
  return (
    <li>
      <Link href={`/@${slug}/${post.id}`} className="flex min-h-11 items-center gap-3 px-4 py-2 hover:text-accent" data-post-row>
        <span className="min-w-0 flex-1 truncate font-semibold">
          {!post.isPublic && <span className="mr-1 text-sm text-ink-soft">{post.publishAt ? `⏰ ${scheduleLabel(post.publishAt)}` : "🔒"}</span>}
          {post.title}
        </span>
        <span className="shrink-0 text-sm text-ink-soft">
          <span aria-label={`공감 ${likeCount}`}>♥ {likeCount}</span>
          {commentCount > 0 && <span aria-label={`댓글 ${commentCount}개`}> · 💬 {commentCount}</span>}
          <span className="max-sm:hidden"> · {formatDate(post.createdAt)}</span>
        </span>
      </Link>
    </li>
  );
}

/** 앨범형: 대표 사진을 크게, 사진이 없으면 제목 첫 글자 칸 (블로그 꾸미기) */
export function PostGalleryTile({ slug, post, likeCount = 0 }: Props) {
  const cover = firstImageUrl(post.contentHtml);
  return (
    <li>
      <Link href={`/@${slug}/${post.id}`} className="block overflow-hidden rounded-xl border border-line bg-surface hover:border-accent" data-post-tile>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- 우리 저장소(/files) 사진, 크기를 모른다
          <img src={cover} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
        ) : (
          <span aria-hidden className="flex aspect-[4/3] w-full items-center justify-center bg-accent/10 text-4xl font-extrabold text-accent">
            {[...post.title.trim()][0] ?? "✎"}
          </span>
        )}
        <span className="block p-3">
          <span className="line-clamp-2 font-bold">
            {!post.isPublic && <span className="mr-1 text-sm text-ink-soft">{post.publishAt ? "⏰" : "🔒"}</span>}
            {post.title}
          </span>
          <span className="mt-1 block text-sm text-ink-soft">
            {formatDate(post.createdAt)} · <span aria-label={`공감 ${likeCount}`}>♥ {likeCount}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
