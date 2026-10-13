import { notFound } from "next/navigation";
import { BlindNotice } from "@/components/post/BlindNotice";
import { PostForm } from "@/components/post/PostForm";
import { parseId } from "@/lib/ids";
import { getCategoryOptions } from "@/server/category";
import { getSeriesOptions } from "@/server/series";
import { getMyBlog, requireMember } from "@/server/dal";
import { getPostForEdit } from "@/server/post";
import { getPostTags } from "@/server/tags";

export const metadata = { title: "글 수정 | Blogville" };

export default async function EditPage({ params }: PageProps<"/write/[postId]">) {
  const member = await requireMember();
  const postId = parseId((await params).postId);
  const post = postId === null ? null : await getPostForEdit(member.userId, postId);
  if (!post) notFound();
  const blog = await getMyBlog(member.userId);
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">글 수정</h1>
      {post.blindedAt && <BlindNotice reason={post.blindReason} />}
      <PostForm
        categories={await getCategoryOptions(blog.id)}
        seriesOptions={await getSeriesOptions(blog.id)}
        initial={{
          postId: post.id,
          title: post.title,
          contentHtml: post.contentHtml,
          categoryId: post.categoryId,
          subcategoryId: post.subcategoryId,
          isPublic: post.isPublic,
          publishAt: post.publishAt,
          seriesId: post.seriesId,
          tags: await getPostTags(post.id),
        }}
      />
    </div>
  );
}
