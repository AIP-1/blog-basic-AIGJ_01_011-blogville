import Link from "next/link";
import { PostForm } from "@/components/post/PostForm";
import { parsePlacePrefill, placeCardHtml, withPlaceTags } from "@/lib/food-review";
import { currentPrompt, parseWeekKey, promptTags } from "@/lib/town/prompts";
import { getCategoryOptions } from "@/server/category";
import { getSeriesOptions } from "@/server/series";
import { getMyBlog, requireMember } from "@/server/dal";
import { trendEnabled } from "@/server/keyword-trend";

export const metadata = { title: "새 글 쓰기 | Blogville" };

export default async function WritePage({ searchParams }: PageProps<"/write">) {
  const member = await requireMember();
  const blog = await getMyBlog(member.userId);
  const params = await searchParams;
  // 🍽 맛집 [후기 쓰기]: 식당 카드와 "맛집, <식당 이름>" 태그를 미리 채운다
  const place = parsePlacePrefill(params);
  // 📝 이번 주 글감 [이 글감으로 쓰기] (`?topic=2026-W42`): "글감, <그 주 태그>" 태그를 채우고 위에 주제를 보인다.
  // 지난주·다음 주 열쇠(옛 링크, 손으로 바꾼 주소)는 받지 않고 이번 주 글감으로 (위에 "이번 주 글감"이라고 보이므로)
  const topicKey = place ? null : parseWeekKey(params.topic);
  const prompt = topicKey ? currentPrompt() : null;
  const prefill = place
    ? { contentHtml: placeCardHtml(place), tags: withPlaceTags("", place.name) }
    : prompt
      ? { contentHtml: "", tags: promptTags(prompt) }
      : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="sr-only">새 글 쓰기</h1>
      {prompt && (
        <p className="px-note mb-4" data-write-topic={prompt.key}>
          📝 이번 주 글감: <strong>{prompt.title}</strong>
          <span className="mt-0.5 block text-sm font-normal">{prompt.hint}</span>
          <Link href="/prompt" className="mt-1 inline-block text-sm font-normal">
            이웃의 답장 보기 ›
          </Link>
        </p>
      )}
      <PostForm keywordHelper={trendEnabled()} categories={await getCategoryOptions(blog.id)} seriesOptions={await getSeriesOptions(blog.id)} draftOwnerId={member.userId} prefill={prefill} />
    </div>
  );
}
