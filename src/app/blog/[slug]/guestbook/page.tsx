import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuestbookSection } from "@/components/blog/GuestbookSection";
import { Pagination } from "@/components/blog/Pagination";
import { GUESTBOOK_PAGE_SIZE, guestbookPath } from "@/lib/guestbook-rules";
import { parsePage } from "@/lib/ids";
import { loginHref } from "@/lib/safe-next";
import { getBlogBySlug } from "@/server/blog";
import { accentProps } from "@/lib/blog-accent";
import { getSession } from "@/server/dal";
import { getGuestbook } from "@/server/guestbook";

export async function generateMetadata({ params }: PageProps<"/blog/[slug]/guestbook">): Promise<Metadata> {
  const found = await getBlogBySlug((await params).slug);
  if (!found) return { title: "길을 잃었어요 | Blogville" };
  return { title: `방명록 | ${found.blog.title}`, alternates: { canonical: guestbookPath(found.blog.slug) } };
}

// 방명록 (BLOG-10, specs/056-guestbook): `/@주소/guestbook`. 최신순 10개씩, 회원은 글을 남기고 주인은 답글을 단다.
export default async function GuestbookPage({ params, searchParams }: PageProps<"/blog/[slug]/guestbook">) {
  const { slug } = await params;
  const found = await getBlogBySlug(slug);
  if (!found) notFound();
  const { blog, nickname } = found;
  const page = parsePage((await searchParams).page);
  const member = await getSession();
  const { items, total } = await getGuestbook(blog, member, page);
  const path = guestbookPath(blog.slug);

  return (
    <div className="mx-auto max-w-3xl space-y-4" {...accentProps(blog.accentColor)}>
      <header className="rounded-2xl border border-line bg-surface p-5">
        <Link href={`/@${blog.slug}`} className="-ml-1 flex min-h-11 w-fit max-w-full items-center px-1 font-semibold text-ink-soft hover:text-ink" data-blog-link>
          <span className="truncate">{blog.title}</span>
        </Link>
        <h1 className="text-2xl font-extrabold">
          📖 방명록 <span className="text-ink-soft">{total}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{nickname}님의 블로그에 인사를 남겨 보세요</p>
      </header>

      <GuestbookSection blogId={blog.id} ownerNickname={nickname} items={items} signedIn={member !== null} loginHref={loginHref(path)} />

      {/* 마지막보다 큰 쪽도 빈 문구 (POST-05) */}
      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-ink-soft">아직 방명록이 없어요</p>
      )}
      <Pagination basePath={path} query={{}} page={page} totalPages={Math.ceil(total / GUESTBOOK_PAGE_SIZE)} />
    </div>
  );
}
