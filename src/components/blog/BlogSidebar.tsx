import Link from "next/link";
import { Suspense } from "react";
import { SECRET_PLACEHOLDER } from "@/lib/comment-rules";
import { excerpt } from "@/lib/text";
import { SEARCH_MAX } from "@/lib/blog-search";
import { guestbookPath } from "@/lib/guestbook-rules";
import type { getBlogSidebar } from "@/server/sidebar";
import type { VisitStats } from "@/server/stats";
import { BlogNews } from "./BlogNews";
import { BlogStocks } from "./BlogStocks";
import { CalendarWidget } from "./widgets/CalendarWidget";
import { WeatherWidget } from "./widgets/WeatherWidget";
import { WIDGET_LIMITS, type WidgetKey, type WidgetLayout, type WidgetSize } from "@/lib/widgets";
import { thumbUrl } from "@/lib/attachments";
import { VisitSparkline } from "./VisitSparkline";
import { VisitCount } from "./VisitCount";

type Props = {
  blogId: number;
  slug: string;
  sidebar: Awaited<ReturnType<typeof getBlogSidebar>>;
  visits: VisitStats;
  recordVisit: boolean;
  search: string;
  /** 마을 검색어(BLOG-07). 주인이 아니면 undefined라 상자가 없다 */
  townSearch?: string;
  activeTag: string | null;
  categoryNav: React.ReactNode;
  isOwner?: boolean;
  layout: WidgetLayout;
  /** ☀️ 날씨 위젯의 블로그 도시·동네 (blogs.weather_city, weather_place·lat·lon) */
  weather: { weatherCity: string | null; weatherPlace: string | null; weatherLat: number | null; weatherLon: number | null };
  /** 주인이 날씨 동네를 찾아 고를 수 있는지 (카카오 열쇠) */
  weatherPlaceSearch?: boolean;
  /** 👣 방문자를 크게 보일 때 최근 7일 (작게면 null) */
  visitDays: { date: string; count: number }[] | null;
};

/** 블로그 홈 오른쪽 옆 칸 (BLOG-09). 휴대폰에서는 글 목록 아래. */
export function BlogSidebar({ blogId, slug, sidebar, visits, recordVisit, search, townSearch, activeTag, categoryNav, isOwner = false, layout, weather, weatherPlaceSearch = false, visitDays }: Props) {
  const empty = <p className="px-1 text-sm text-ink-soft">아직 없어요</p>;
  const linkClass = "flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-bg";
  const sizeOf = (key: WidgetKey): WidgetSize => layout.items.find((it) => it.key === key)?.size ?? "lg";
  const lim = (key: WidgetKey) => WIDGET_LIMITS[sizeOf(key)];
  const render = (key: WidgetKey): React.ReactNode => {
    switch (key) {
      case "guestbook":
        return (
          // 방명록 (BLOG-10): 비밀 방명록도 센다
          <Link href={guestbookPath(slug)} className="widget flex min-h-11 items-center gap-2 font-semibold hover:bg-bg" data-guestbook-link>
            <span aria-hidden>📖</span> 방명록 <span className="ml-auto text-sm font-normal text-ink-soft">{sidebar.guestbookCount}</span>
          </Link>
        );
      case "news":
        return (
          <Suspense fallback={null}>
            <BlogNews size={sizeOf("news")} />
          </Suspense>
        );
      case "stocks":
        // 📈 관심 종목: 시세를 받는 동안 나머지 옆 칸을 막지 않는다
        return (
          <Suspense fallback={null}>
            <BlogStocks blogId={blogId} slug={slug} isOwner={isOwner} size={sizeOf("stocks")} />
          </Suspense>
        );
      case "calendar":
        return (
          <Suspense fallback={<section className="widget min-h-72" aria-hidden />}>
            <CalendarWidget blog={{ id: blogId, slug }} isOwner={isOwner} />
          </Suspense>
        );
      case "weather":
        return <WeatherWidget blog={weather} isOwner={isOwner} placeSearch={isOwner && weatherPlaceSearch} />;
      case "search":
        return (
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
        );
      case "town":
        if (townSearch === undefined) return null;
        return (
          <>
          {townSearch !== undefined && (
            <section className="widget" aria-labelledby="w-town-search">
              <h2 id="w-town-search" className="widget-title">
                🏘 마을 검색
              </h2>
              <form action={`/@${slug}`} role="search" className="flex gap-2">
                <input name="q" type="search" aria-label="검색어" defaultValue={townSearch} maxLength={SEARCH_MAX} placeholder="마을의 글·블로그 검색" className="field min-w-0 flex-1" />
                <button type="submit" className="btn">
                  검색
                </button>
              </form>
            </section>
          )}
          </>
        );
      case "categories":
        return categoryNav;
      case "recent":
        return (
          <section className="widget" aria-labelledby="w-recent">
            <h2 id="w-recent" className="widget-title">
              📝 최근 글
            </h2>
            {sidebar.recent.length === 0 ? (
              empty
            ) : (
              <ul>
                {sidebar.recent.slice(0, lim("recent").list).map((p) => (
                  <li key={p.id}>
                    <Link href={`/@${slug}/${p.id}`} className={linkClass}>
                      {sizeOf("recent") === "lg" && p.imageKey && (
                        // eslint-disable-next-line @next/next/no-img-element -- 우리 저장소(/files) 사진
                        <img src={thumbUrl(`/files/${p.imageKey}`, 96)} alt="" loading="lazy" className="size-10 shrink-0 rounded-md border border-line object-cover" />
                      )}
                      <span className="min-w-0 truncate">{p.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      case "popular":
        return (
          <section className="widget" aria-labelledby="w-popular">
            <h2 id="w-popular" className="widget-title">
              🔥 인기 글
            </h2>
            {sidebar.popular.length === 0 ? (
              empty
            ) : (
              <ol>
                {sidebar.popular.slice(0, lim("popular").list).map((p) => (
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
        );
      case "comments":
        return (
          <section className="widget" aria-labelledby="w-comments">
            <h2 id="w-comments" className="widget-title">
              💬 최근 댓글
            </h2>
            {sidebar.comments.length === 0 ? (
              empty
            ) : (
              <ul>
                {sidebar.comments.slice(0, lim("comments").list).map((c) => (
                  <li key={`${c.kind}-${c.id}`}>
                    <Link href={`/@${slug}/${c.postId}#${c.kind}-${c.id}`} className={`${linkClass} text-sm`}>
                      <span className="min-w-0 flex-1 truncate">
                        {c.kind === "reply" && <span aria-label="답글">↳ </span>}
                        {/* 볼 수 없는 비밀 댓글은 내용 없이 문구만 (서버가 비워 보낸다) */}
                        {c.hidden ? SECRET_PLACEHOLDER : excerpt(c.content, 40)}
                      </span>
                      <span className="shrink-0 text-ink-soft">{c.nickname ?? "알 수 없음"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      case "tags":
        return (
          <section className="widget" aria-labelledby="w-tags">
            <h2 id="w-tags" className="widget-title">
              🏷 태그
            </h2>
            {sidebar.tags.length === 0 ? (
              empty
            ) : (
              <ul className="flex flex-wrap gap-2">
                {sidebar.tags.slice(0, lim("tags").tags).map((t) => (
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
        );
      case "visits":
        return (
          <section className="widget" aria-labelledby="w-visits">
            <h2 id="w-visits" className="widget-title">
              👣 방문자
            </h2>
            <VisitCount blogId={blogId} initial={visits} record={recordVisit} />
            {visitDays && <VisitSparkline days={visitDays} />}
          </section>
        );
      case "rss":
        // 구독: RSS 리더에 이 주소를 넣으면 새 글을 받아 본다. 내려받지 않고 새 탭에서 연다
        return (
          <a href={`/@${slug}/rss`} target="_blank" rel="noopener" className="widget flex min-h-11 items-center gap-2 text-sm hover:bg-bg" data-rss>
            <span aria-hidden>📡</span> RSS로 구독하기
          </a>
        );
    }
  };
  return (
    <aside aria-label="옆 칸" className="blog-aside min-w-0" data-sidebar>
      {layout.items
        .filter((it) => it.visible)
        .map((it) => {
          const node = render(it.key);
          return node ? (
            <div key={it.key} data-widget-slot={it.key} data-size={it.size}>
              {node}
            </div>
          ) : null;
        })}
    </aside>
  );
}
