import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewCount } from "@/components/blog/ViewCount";
import { CategoryBadge } from "@/components/post/CategoryBadge";
import { DeletePostButton } from "@/components/post/DeletePostButton";
import { CommentSection } from "@/components/post/CommentSection";
import { LikeButton } from "@/components/post/LikeButton";
import { AdjacentPosts } from "@/components/post/AdjacentPosts";
import { TagList } from "@/components/post/TagList";
import { parseId } from "@/lib/ids";
import { formatDate } from "@/lib/text";
import { getBlogBySlug } from "@/server/blog";
import { getSession } from "@/server/dal";
import { getAdjacentPosts, getPostForView } from "@/server/post";
import { getCommentThread } from "@/server/comments";
import { getLikeState } from "@/server/likes";
import { hasViewedToday } from "@/server/stats";
import { getPostTags } from "@/server/tags";
import { readVisitorId } from "@/server/visitor";

async function load(slug: string, rawId: string) {
  const postId = parseId(rawId);
  if (postId === null) return null;
  const found = await getBlogBySlug(slug);
  if (!found) return null;
  const member = await getSession();
  const isOwner = member?.userId === found.blog.ownerId;
  const row = await getPostForView(found.blog.id, postId, isOwner);
  return row ? { ...found, ...row, isOwner, member } : null;
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]/[postId]">): Promise<Metadata> {
  const { slug, postId } = await params;
  const data = await load(slug, postId);
  if (!data) return { title: "길을 잃었어요 | Blogville" };
  // 비공개 글은 주인이 봐도 제목을 탭·기록에 남기지 않는다 (POST-02)
  return { title: data.post.isPublic ? `${data.post.title} | ${data.blog.title}` : "글 | Blogville" };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]/[postId]">) {
  const { slug, postId } = await params;
  const data = await load(slug, postId);
  if (!data) notFound();
  const { blog, nickname, post, categoryName, subcategoryName, isOwner, member } = data;
  const [thread, adjacent] = await Promise.all([getCommentThread(post.id, blog.ownerId, member), getAdjacentPosts(blog.id, post.id, isOwner)]);
  const categoryHref = post.categoryId
    ? `/@${blog.slug}?category=${post.categoryId}${post.subcategoryId ? `&sub=${post.subcategoryId}` : ""}`
    : undefined;
  const edited = post.updatedAt.getTime() - post.createdAt.getTime() > 1000;
  // 조회수 (POST-06): 서버 렌더는 바꾸지 않는다. 오늘 처음 연 브라우저면 +1 한 값으로 시작한다.
  const countsView = !isOwner && post.isPublic;
  const firstToday = countsView && !(await hasViewedToday(post.id, await readVisitorId()));

  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-5 md:p-8">
      <Link href={`/@${blog.slug}`} className="-ml-1 flex min-h-11 w-fit max-w-full items-center px-1 font-semibold text-ink-soft hover:text-ink" data-blog-link>
        <span className="truncate">📖 {blog.title}</span>
      </Link>
      <CategoryBadge categoryName={categoryName} subcategoryName={subcategoryName} href={categoryHref} />
      <h1 className="mt-2 text-3xl font-extrabold">{post.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {nickname} · {formatDate(post.createdAt)}
        {edited && " · 수정됨"}
        {" · "}
        <ViewCount postId={post.id} initial={post.viewCount + (firstToday ? 1 : 0)} record={countsView} />
        {!post.isPublic && <span className="ml-2 font-semibold">🔒 비공개</span>}
      </p>
      {/* content_html은 저장할 때 허용 태그만 남긴 HTML이다 (NF-03) */}
      <div className="prose-post mt-6" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      <TagList tags={await getPostTags(post.id)} />
      <LikeButton postId={post.id} {...await getLikeState(post.id, member?.userId ?? null)} canLike={member !== null} />
      <AdjacentPosts slug={blog.slug} {...adjacent} />
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <Link href={`/@${blog.slug}`} className="btn">
          목록으로
        </Link>
        {isOwner && (
          <div className="flex gap-2">
            <Link href={`/write/${post.id}`} className="btn">
              수정
            </Link>
            <DeletePostButton postId={post.id} />
          </div>
        )}
      </footer>
      <CommentSection postId={post.id} items={thread.items} count={thread.count} signedIn={member !== null} />
    </article>
  );
}
