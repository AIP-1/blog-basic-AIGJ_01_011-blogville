import Link from "next/link";
import type { listActiveBlogs } from "@/server/feed";

/** 마을 소식 1페이지 맨 위 `🏡 블로그 둘러보기`: 최근에 공개 글을 쓴 블로그 (SOC-05) */
export function BlogBrowse({ blogs }: { blogs: Awaited<ReturnType<typeof listActiveBlogs>> }) {
  if (blogs.length === 0) return null;
  return (
    <section aria-labelledby="browse-title" className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <h2 id="browse-title" className="mb-3 font-bold">
        🏡 블로그 둘러보기
      </h2>
      <ul className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        {blogs.map((b) => (
          <li key={b.slug} className="min-w-0" data-browse={b.slug}>
            <Link href={`/@${b.slug}`} className="flex min-h-11 flex-col justify-center rounded-xl border border-line px-3 py-2 hover:border-accent">
              <span className="truncate font-semibold">{b.title}</span>
              <span className="truncate text-sm text-ink-soft">
                {b.nickname} · 글 {b.postCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
