import Link from "next/link";
import { Pagination } from "@/components/blog/Pagination";
import { PostRowActions } from "@/components/settings/PostRowActions";
import { parseSearchQuery, SEARCH_EMPTY, SEARCH_MAX } from "@/lib/blog-search";
import { parseId, parsePage } from "@/lib/ids";
import { formatDate } from "@/lib/text";
import { getCategoryTree } from "@/server/category";
import { getMyBlog, requireMember } from "@/server/dal";
import { countMyPosts, listBlogPosts } from "@/server/post";

export const metadata = { title: "글 관리 | Blogville" };

const MANAGE_PAGE_SIZE = 20;

/**
 * 글 관리 (BLOG-08): 주인만. 내 글을 공개·비공개 모두 거르고(상태·카테고리·검색) 찾고 고치고 지운다.
 * 주소: `?visibility=public|private`, `?cat=c{대분류}|s{소분류}`, `?s=`, `?page=`
 */
export default async function ManagePostsPage({ searchParams }: PageProps<"/settings/posts">) {
  const member = await requireMember();
  const blog = await getMyBlog(member.userId);
  const query = await searchParams;
  const page = parsePage(query.page);
  const tree = await getCategoryTree(blog.id, true);

  const visibility = query.visibility === "public" || query.visibility === "private" ? query.visibility : null;
  const searchParam = parseSearchQuery(query.s);
  const search = searchParam === "empty" ? null : searchParam;
  const cat = typeof query.cat === "string" ? query.cat : "";
  const catId = cat.startsWith("c") ? parseId(cat.slice(1)) : null;
  const subId = cat.startsWith("s") ? parseId(cat.slice(1)) : null;
  const sub = tree.flatMap((c) => c.subs.map((s) => ({ ...s, parent: c.id }))).find((s) => s.id === subId);
  const categoryId = sub ? sub.parent : tree.some((c) => c.id === catId) ? catId : null;

  const [counts, { items, total }] = await Promise.all([
    countMyPosts(blog.id),
    listBlogPosts(blog.id, {
      viewerIsOwner: true,
      visibility,
      search,
      categoryId,
      subcategoryId: sub?.id ?? null,
      pageSize: MANAGE_PAGE_SIZE,
      page,
    }),
  ]);
  const keep: Record<string, string> = {};
  if (visibility) keep.visibility = visibility;
  if (categoryId !== null) keep.cat = sub ? `s${sub.id}` : `c${categoryId}`;
  if (search) keep.s = search;
  const filtered = Object.keys(keep).length > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">📝 글 관리</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/write" className="btn btn-primary">
            ✏️ 새 글 쓰기
          </Link>
          <Link href={`/@${blog.slug}`} className="btn">
            내 블로그로 →
          </Link>
        </div>
      </div>
      <p className="text-ink-soft" aria-label="글 수">
        전체 {counts.all} · 공개 {counts.public} · 비공개 {counts.private}
      </p>

      <form role="search" aria-label="글 거르기" className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4">
        <label className="flex flex-col gap-1 text-sm">
          상태
          <select name="visibility" defaultValue={visibility ?? ""} className="field">
            <option value="">전체</option>
            <option value="public">공개</option>
            <option value="private">비공개</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          카테고리
          <select name="cat" defaultValue={categoryId === null ? "" : (keep.cat ?? "")} className="field">
            <option value="">전체</option>
            {tree.flatMap((c) => [
              <option key={`c${c.id}`} value={`c${c.id}`}>
                {c.name}
              </option>,
              ...c.subs.map((s) => (
                <option key={`s${s.id}`} value={`s${s.id}`}>
                  └ {s.name}
                </option>
              )),
            ])}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm">
          제목·본문 검색
          <input name="s" type="search" defaultValue={search ?? ""} maxLength={SEARCH_MAX} className="field" />
        </label>
        <button type="submit" className="btn btn-primary">
          거르기
        </button>
        {filtered && (
          <Link href="/settings/posts" className="btn btn-ghost">
            조건 지우기
          </Link>
        )}
      </form>

      {searchParam === "empty" && (
        <p role="alert" className="form-error">
          {SEARCH_EMPTY}
        </p>
      )}

      <section aria-labelledby="manage-title" className="rounded-2xl border border-line bg-surface">
        <h2 id="manage-title" className="border-b border-line px-4 py-3 font-bold">
          {filtered ? `찾은 글 ${total}개` : `내 글 ${total}개`}
        </h2>
        {items.length === 0 ? (
          <div className="p-8 text-center text-ink-soft">
            <p>{filtered ? "조건에 맞는 글이 없어요" : "아직 쓴 글이 없어요."}</p>
            {!filtered && (
              <Link href="/write" className="btn btn-primary mt-4">
                ✏️ 첫 글 쓰기
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map(({ post, categoryName, subcategoryName, commentCount }) => (
              <li key={post.id} className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <Link href={`/@${blog.slug}/${post.id}`} className="block truncate font-semibold hover:text-accent">
                    {post.title}
                  </Link>
                  <p className="text-sm text-ink-soft">
                    {post.isPublic ? "🌐 공개" : "🔒 비공개"}
                    {categoryName && ` · ${subcategoryName ? `${categoryName} › ${subcategoryName}` : categoryName}`}
                    {` · ${formatDate(post.createdAt)} · 👀 ${post.viewCount} · 💬 ${commentCount}`}
                  </p>
                </div>
                <PostRowActions postId={post.id} title={post.title} isPublic={post.isPublic} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <Pagination basePath="/settings/posts" query={keep} page={page} totalPages={Math.ceil(total / MANAGE_PAGE_SIZE)} />
    </div>
  );
}
