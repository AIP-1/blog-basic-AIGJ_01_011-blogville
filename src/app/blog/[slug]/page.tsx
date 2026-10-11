import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogSidebar } from "@/components/blog/BlogSidebar";
import { CategoryNav } from "@/components/blog/CategoryNav";
import { FollowButton } from "@/components/blog/FollowButton";
import { Pagination } from "@/components/blog/Pagination";
import { PostCard } from "@/components/blog/PostCard";
import { parseSearchQuery, parseTagFilter, SEARCH_EMPTY } from "@/lib/blog-search";
import { parseId, parsePage } from "@/lib/ids";
import { getBlogBySlug } from "@/server/blog";
import { getCategoryTree } from "@/server/category";
import { getSession } from "@/server/dal";
import { countFollowers, isFollowing } from "@/server/follows";
import { countMyPosts, listBlogPosts, PAGE_SIZE } from "@/server/post";
import { getBlogSidebar } from "@/server/sidebar";
import { getBlogVisitStats } from "@/server/stats";

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

  // 검색 → 태그 → 카테고리 순서로 하나만 쓴다 (BLOG-09)
  const searchParam = parseSearchQuery(query.s);
  const search = searchParam === "empty" ? null : searchParam;
  const tag = search || searchParam === "empty" ? null : parseTagFilter(query.tag);
  const filtered = search !== null || tag !== null || searchParam === "empty";

  const [{ items, total }, { total: allTotal }, sidebar, visits, myPostCount, followers, following] = await Promise.all([
    searchParam === "empty"
      ? { items: [], total: 0 }
      : listBlogPosts(blog.id, { viewerIsOwner: isOwner, categoryId, subcategoryId: subId, search, tag, page }),
    // `전체 글 (N)`은 누가 보든 공개 글 수다
    listBlogPosts(blog.id, { viewerIsOwner: false, page: 1 }),
    getBlogSidebar(blog.id, isOwner),
    getBlogVisitStats(blog.id),
    isOwner ? countMyPosts(blog.id).then((c) => c.all) : 0,
    countFollowers(blog.ownerId),
    // 이웃 버튼은 회원이 남의 블로그를 볼 때만 (SOC-04)
    member && !isOwner ? isFollowing(member.userId, blog.ownerId) : false,
  ]);
  const filterQuery: Record<string, string> = {};
  if (search) filterQuery.s = search;
  else if (tag) filterQuery.tag = tag;
  else {
    if (categoryId !== null) filterQuery.category = String(categoryId);
    if (subId !== null) filterQuery.sub = String(subId);
  }
  const listTitle = search
    ? `🔍 '${search}' 블로그 검색 ${total}개`
    : tag
      ? `#${tag} ${total}개`
      : `${sub?.name ?? tree.find((c) => c.id === categoryId)?.name ?? "전체 글"} ${total}개`;

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
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-soft" aria-label="블로그 정보">
            by {nickname} · @{blog.slug} · 글 {allTotal} · <span data-followers>이웃 {followers}</span>
          </p>
          {member && !isOwner && <FollowButton ownerId={blog.ownerId} following={following} />}
        </div>
        {isOwner && (
          // 주인 도구 막대 (BLOG-08)
          <nav aria-label="주인 도구" className="mt-4 flex flex-wrap gap-2">
            <Link href="/write" className="btn btn-primary">
              ✏️ 새 글 쓰기
            </Link>
            <Link href="/settings/posts" className="btn">
              📝 글 관리 {myPostCount}
            </Link>
            <Link href="/settings/blog#categories" className="btn">
              🗂 카테고리 관리
            </Link>
            <Link href="/settings/blog" className="btn">
              ⚙️ 블로그 설정
            </Link>
          </nav>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="list-title" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="list-title" className="text-lg font-bold">
              {listTitle}
            </h2>
            {filtered && (
              <Link href={`/@${blog.slug}`} className="btn btn-ghost">
                ← 전체 글 보기
              </Link>
            )}
          </div>
          {searchParam === "empty" ? (
            <p role="alert" className="form-error">
              {SEARCH_EMPTY}
            </p>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">
              <p>{filtered ? "이 블로그에서 찾은 글이 없어요" : categoryId === null ? "아직 쓴 글이 없어요." : "이 카테고리에 글이 없어요."}</p>
              {isOwner && !filtered && (
                <Link href="/write" className="btn btn-primary mt-4">
                  ✏️ 첫 글 쓰기
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((row) => (
                <PostCard key={row.post.id} slug={blog.slug} post={row.post} categoryName={row.categoryName} subcategoryName={row.subcategoryName} commentCount={row.commentCount} likeCount={row.likeCount} />
              ))}
            </div>
          )}
          <Pagination basePath={`/@${blog.slug}`} query={filterQuery} page={page} totalPages={Math.ceil(total / PAGE_SIZE)} />
        </section>
        <BlogSidebar
          blogId={blog.id}
          slug={blog.slug}
          sidebar={sidebar}
          visits={visits}
          recordVisit={!isOwner}
          search={search ?? ""}
          activeTag={tag}
          // 검색·태그로 볼 때는 카테고리에서 고른 항목이 없다
          categoryNav={
            <CategoryNav slug={blog.slug} tree={tree} total={allTotal} categoryId={filtered ? -1 : categoryId} subId={filtered ? -1 : subId} />
          }
        />
      </div>
    </div>
  );
}
