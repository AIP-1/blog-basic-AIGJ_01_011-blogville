import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/post/CategoryBadge";
import { DeletePostButton } from "@/components/post/DeletePostButton";
import { CommentSection } from "@/components/post/CommentSection";
import { TagList } from "@/components/post/TagList";
import { parseId } from "@/lib/ids";
import { formatDate } from "@/lib/text";
import { getBlogBySlug } from "@/server/blog";
import { getSession } from "@/server/dal";
import { getPostForView } from "@/server/post";
import { getCommentThread } from "@/server/comments";
import { getPostTags } from "@/server/tags";

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
  return { title: data ? `${data.post.title} | ${data.blog.title}` : "길을 잃었어요 | Blogville" };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]/[postId]">) {
  const { slug, postId } = await params;
  const data = await load(slug, postId);
  if (!data) notFound();
  const { blog, nickname, post, categoryName, subcategoryName, isOwner, member } = data;
  const thread = await getCommentThread(post.id, blog.ownerId, member);
  const categoryHref = post.categoryId
    ? `/@${blog.slug}?category=${post.categoryId}${post.subcategoryId ? `&sub=${post.subcategoryId}` : ""}`
    : undefined;
  const edited = post.updatedAt.getTime() - post.createdAt.getTime() > 1000;

  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-line bg-surface p-5 md:p-8">
      <CategoryBadge categoryName={categoryName} subcategoryName={subcategoryName} href={categoryHref} />
      <h1 className="mt-2 text-3xl font-extrabold">{post.title}</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {nickname} · {formatDate(post.createdAt)}
        {edited && " · 수정됨"}
        {!post.isPublic && <span className="ml-2 font-semibold">🔒 비공개</span>}
      </p>
      {/* content_html은 저장할 때 허용 태그만 남긴 HTML이다 (NF-03) */}
      <div className="prose-post mt-6" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      <TagList tags={await getPostTags(post.id)} />
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
