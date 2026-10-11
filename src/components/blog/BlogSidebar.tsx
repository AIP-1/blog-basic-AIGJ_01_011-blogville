import Link from "next/link";
import { excerpt } from "@/lib/text";
import { SEARCH_MAX } from "@/lib/blog-search";
import type { getBlogSidebar } from "@/server/sidebar";
import type { VisitStats } from "@/server/stats";
import { VisitCount } from "./VisitCount";

type Props = {
  blogId: number;
  slug: string;
  sidebar: Awaited<ReturnType<typeof getBlogSidebar>>;
  visits: VisitStats;
  recordVisit: boolean;
  search: string;
  activeTag: string | null;
  categoryNav: React.ReactNode;
};

/** 블로그 홈 오른쪽 옆 칸 (BLOG-09). 휴대폰에서는 글 목록 아래. */
export function BlogSidebar({ blogId, slug, sidebar, visits, recordVisit, search, activeTag, categoryNav }: Props) {
  const empty = <p className="px-1 text-sm text-ink-soft">아직 없어요</p>;
  const linkClass = "flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-bg";
  return (
    <aside aria-label="옆 칸" className="min-w-0 space-y-4">
      <section className="widget" aria-labelledby="w-search">
        <h2 id="w-search" className="widget-title">
          🔍 블로그 검색
        </h2>
        <form action={`/@${slug}`} role="search" className="flex gap-2">
          <input name="s" type="search" aria-label="블로그 검색어" defaultValue={search} maxLength={SEARCH_MAX} placeholder="이 블로그에서 찾기" className="field min-w-0 flex-1" />
          <button type="submit" className="btn">
            찾기
          </button>
        </form>
      </section>

      {categoryNav}

      <section className="widget" aria-labelledby="w-recent">
        <h2 id="w-recent" className="widget-title">
          📝 최근 글
        </h2>
        {sidebar.recent.length === 0 ? (
          empty
        ) : (
          <ul>
            {sidebar.recent.map((p) => (
              <li key={p.id}>
                <Link href={`/@${slug}/${p.id}`} className={linkClass}>
                  <span className="min-w-0 truncate">{p.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="widget" aria-labelledby="w-popular">
        <h2 id="w-popular" className="widget-title">
          🔥 인기 글
        </h2>
        {sidebar.popular.length === 0 ? (
          empty
        ) : (
          <ol>
            {sidebar.popular.map((p) => (
              <li key={p.id}>
                <Link href={`/@${slug}/${p.id}`} className={linkClass}>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  <span className="shrink-0 text-sm text-ink-soft">👀 {p.viewCount}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="widget" aria-labelledby="w-comments">
        <h2 id="w-comments" className="widget-title">
          💬 최근 댓글
        </h2>
        {sidebar.comments.length === 0 ? (
          empty
        ) : (
          <ul>
            {sidebar.comments.map((c) => (
              <li key={`${c.kind}-${c.id}`}>
                <Link href={`/@${slug}/${c.postId}#${c.kind}-${c.id}`} className={`${linkClass} text-sm`}>
                  <span className="min-w-0 flex-1 truncate">
                    {c.kind === "reply" && <span aria-label="답글">↳ </span>}
                    {excerpt(c.content, 40)}
                  </span>
                  <span className="shrink-0 text-ink-soft">{c.nickname ?? "알 수 없음"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="widget" aria-labelledby="w-tags">
        <h2 id="w-tags" className="widget-title">
          🏷 태그
        </h2>
        {sidebar.tags.length === 0 ? (
          empty
        ) : (
          <ul className="flex flex-wrap gap-2">
            {sidebar.tags.map((t) => (
              <li key={t.name}>
                <Link
                  href={`/@${slug}?tag=${encodeURIComponent(t.name)}`}
                  aria-current={activeTag === t.name ? "page" : undefined}
                  className="tag-chip"
                >
                  #{t.name} <span className="tag-count">{t.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="widget" aria-labelledby="w-visits">
        <h2 id="w-visits" className="widget-title">
          👣 방문자
        </h2>
        <VisitCount blogId={blogId} initial={visits} record={recordVisit} />
      </section>
    </aside>
  );
}
