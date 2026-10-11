import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryNav } from "@/components/blog/CategoryNav";
import { Pagination } from "@/components/blog/Pagination";
import { PostCard } from "@/components/blog/PostCard";
import { parseId, parsePage } from "@/lib/ids";
import { getBlogBySlug } from "@/server/blog";
import { getCategoryTree } from "@/server/category";
import { getSession } from "@/server/dal";
import { listBlogPosts, PAGE_SIZE } from "@/server/post";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const found = await getBlogBySlug((await params).slug);
  return { title: found ? `${found.blog.title} | Blogville` : "길을 잃었어요 | Blogville" };
}

export default async function BlogHome({ params, searchParams }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const found = await getBlogBySlug(slug);
  if (!found) notFound();
  const { blog, nickname } = found;

  const member = await getSession();
  const isOwner = member?.userId === blog.ownerId;
  const page = parsePage(query.page);
  const tree = await getCategoryTree(blog.id, isOwner);

  // ?sub가 있으면 ?category보다 먼저 쓴다. 이상한 값은 무시하고 전체를 보여준다 (POST-05).
  const subParam = parseId(query.sub);
  const sub = subParam === null ? undefined : tree.flatMap((c) => c.subs.map((s) => ({ ...s, parent: c.id }))).find((s) => s.id === subParam);
  const catParam = parseId(query.category);
  const categoryId = sub ? sub.parent : tree.some((c) => c.id === catParam) ? catParam : null;
  const subId = sub?.id ?? null;

  const { items, total } = await listBlogPosts(blog.id, { viewerIsOwner: isOwner, categoryId, subcategoryId: subId, page });
  const { total: allTotal } = categoryId === null ? { total } : await listBlogPosts(blog.id, { viewerIsOwner: isOwner, page: 1 });
  const filterQuery: Record<string, string> = {};
  if (categoryId !== null) filterQuery.category = String(categoryId);
  if (subId !== null) filterQuery.sub = String(subId);

  return (
    <div className="space-y-6">
      {isOwner && query.welcome === "1" && (
        <section className="rounded-2xl border border-accent/40 bg-accent/5 p-4" aria-label="환영">
          <p className="font-semibold">🎉 {nickname}님, Blogville에 오신 걸 환영해요!</p>
          <p className="mt-1 text-ink-soft">여기는 {nickname}님의 블로그예요. 첫 글을 써 보세요.</p>
        </section>
      )}

      <header className="rounded-2xl border border-line bg-surface p-5">
        <h1 className="text-2xl font-extrabold">{blog.title}</h1>
        {blog.intro && <p className="mt-2 text-ink-soft">{blog.intro}</p>}
        <p className="mt-2 text-sm text-ink-soft">by {nickname}</p>
        {isOwner && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/write" className="btn btn-primary">
              ✏️ 새 글 쓰기
            </Link>
            <Link href="/settings/blog" className="btn">
              ⚙️ 블로그 관리
            </Link>
          </div>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside>
          <CategoryNav slug={blog.slug} tree={tree} total={allTotal} categoryId={categoryId} subId={subId} />
        </aside>
        <section aria-label="글 목록">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">
              <p>{categoryId === null ? "아직 쓴 글이 없어요." : "이 카테고리에 글이 없어요."}</p>
              {isOwner && (
                <Link href="/write" className="btn btn-primary mt-4">
                  ✏️ 첫 글 쓰기
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((row) => (
                <PostCard key={row.post.id} slug={blog.slug} post={row.post} categoryName={row.categoryName} subcategoryName={row.subcategoryName} commentCount={row.commentCount} />
              ))}
            </div>
          )}
          <Pagination basePath={`/@${blog.slug}`} query={filterQuery} page={page} totalPages={Math.ceil(total / PAGE_SIZE)} />
        </section>
      </div>
    </div>
  );
}
