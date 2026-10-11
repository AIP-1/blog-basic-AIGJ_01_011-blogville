import type { Metadata } from "next";
import { Pagination } from "@/components/blog/Pagination";
import { PopularTags } from "@/components/blog/PopularTags";
import { PostCard } from "@/components/blog/PostCard";
import { tagHref } from "@/components/post/TagList";
import { parsePage } from "@/lib/ids";
import { PAGE_SIZE } from "@/server/post";
import { getPopularTags, listTagPosts } from "@/server/tags";

/**
 * 주소의 태그 이름. Next 16은 페이지에는 인코딩된 값(`100%25`)을, generateMetadata에는
 * 디코딩된 값(`100%`)을 넘기므로(명세 #20) 디코딩에 실패하면 받은 값을 그대로 쓴다.
 */
function tagName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: PageProps<"/tags/[name]">): Promise<Metadata> {
  const name = tagName((await params).name);
  return { title: `#${name} | Blogville` };
}

// 태그별 글 (POST-04): 모든 블로그의 공개 글. 로그인 필요 없음.
export default async function TagPage({ params, searchParams }: PageProps<"/tags/[name]">) {
  const name = tagName((await params).name);
  const page = parsePage((await searchParams).page);
  const [{ items, total }, popular] = await Promise.all([
    listTagPosts(name, page),
    getPopularTags(),
  ]);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <section aria-labelledby="tag-title" className="min-w-0">
        <h1 id="tag-title" className="text-2xl font-extrabold [overflow-wrap:anywhere]">
          🏷 #{name}
        </h1>
        {items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">이 태그가 달린 글이 없어요.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {items.map((row) => (
              <PostCard
                key={row.post.id}
                slug={row.blogSlug}
                post={row.post}
                categoryName={row.categoryName}
                subcategoryName={row.subcategoryName}
                blogTitle={row.blogTitle}
                commentCount={row.commentCount}
              />
            ))}
          </div>
        )}
        <Pagination basePath={tagHref(name)} query={{}} page={page} totalPages={Math.ceil(total / PAGE_SIZE)} />
      </section>
      <aside className="md:sticky md:top-4 md:self-start">
        <PopularTags tags={popular} />
      </aside>
    </div>
  );
}
