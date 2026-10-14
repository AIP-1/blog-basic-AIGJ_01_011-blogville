import { notFound } from "next/navigation";
import { BlindNotice } from "@/components/post/BlindNotice";
import { PostForm } from "@/components/post/PostForm";
import { parsePlacePrefill, placeCardHtml, withPlaceTags } from "@/lib/food-review";
import { parseId } from "@/lib/ids";
import { getCategoryOptions } from "@/server/category";
import { getSeriesOptions } from "@/server/series";
import { getMyBlog, requireMember } from "@/server/dal";
import { trendEnabled } from "@/server/keyword-trend";
import { getPostForEdit } from "@/server/post";
import { getPostTags } from "@/server/tags";

export const metadata = { title: "글 수정 | Blogville" };

export default async function EditPage({ params, searchParams }: PageProps<"/write/[postId]">) {
  const member = await requireMember();
  const postId = parseId((await params).postId);
  const post = postId === null ? null : await getPostForEdit(member.userId, postId);
  if (!post) notFound();
  const blog = await getMyBlog(member.userId);
  const tags = await getPostTags(post.id);
  // 🍽 맛집 [후기 쓰기]로 고치러 왔으면 본문 앞에 식당 카드, 태그에 "맛집, <식당 이름>"을 더한다 (저장해야 반영)
  const place = parsePlacePrefill(await searchParams);
  const contentHtml = place ? placeCardHtml(place) + post.contentHtml : post.contentHtml;
  const tagText = place ? withPlaceTags(tags.join(", "), place.name) : null;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">글 수정</h1>
      {post.blindedAt && <BlindNotice reason={post.blindReason} />}
      <PostForm keywordHelper={trendEnabled()}
        categories={await getCategoryOptions(blog.id)}
        seriesOptions={await getSeriesOptions(blog.id)}
        initial={{
          postId: post.id,
          title: post.title,
          contentHtml,
          categoryId: post.categoryId,
          subcategoryId: post.subcategoryId,
          isPublic: post.isPublic,
          publishAt: post.publishAt,
          seriesId: post.seriesId,
          tags: tagText === null ? tags : tagText.split(", "),
        }}
      />
    </div>
  );
}
