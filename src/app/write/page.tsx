import { PostForm } from "@/components/post/PostForm";
import { parsePlacePrefill, placeCardHtml, withPlaceTags } from "@/lib/food-review";
import { getCategoryOptions } from "@/server/category";
import { getSeriesOptions } from "@/server/series";
import { getMyBlog, requireMember } from "@/server/dal";
import { trendEnabled } from "@/server/keyword-trend";

export const metadata = { title: "새 글 쓰기 | Blogville" };

export default async function WritePage({ searchParams }: PageProps<"/write">) {
  const member = await requireMember();
  const blog = await getMyBlog(member.userId);
  // 🍽 맛집 [후기 쓰기]: 식당 카드와 "맛집, <식당 이름>" 태그를 미리 채운다
  const place = parsePlacePrefill(await searchParams);
  const prefill = place ? { contentHtml: placeCardHtml(place), tags: withPlaceTags("", place.name) } : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">새 글 쓰기</h1>
      <PostForm keywordHelper={trendEnabled()} categories={await getCategoryOptions(blog.id)} seriesOptions={await getSeriesOptions(blog.id)} draftOwnerId={member.userId} prefill={prefill} />
    </div>
  );
}
