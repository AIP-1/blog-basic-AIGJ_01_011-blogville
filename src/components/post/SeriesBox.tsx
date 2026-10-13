import Link from "next/link";
import { getSeriesNav } from "@/server/series";

/**
 * 글 위 시리즈 상자 (개선 12): "📚 시리즈 이름 · 2/5", 펼치면 순서대로 모든 편, 이전 편·다음 편.
 * 보는 사람이 볼 수 있는 글만 센다 (남에게는 비공개·예약 글이 빠진다).
 */
export async function SeriesBox({ slug, seriesId, postId, viewerIsOwner }: { slug: string; seriesId: number; postId: number; viewerIsOwner: boolean }) {
  const nav = await getSeriesNav(seriesId, viewerIsOwner);
  if (!nav) return null;
  const index = nav.items.findIndex((i) => i.id === postId);
  if (index < 0) return null;
  const prev = nav.items[index - 1];
  const next = nav.items[index + 1];
  return (
    <section aria-label={`시리즈 ${nav.title}`} className="mt-5 rounded-xl border border-line bg-bg p-4" data-series>
      <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-sm text-ink-soft">📚 시리즈</span>
            <span className="block truncate font-bold">{nav.title}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-ink-soft" data-series-position>
            {index + 1}/{nav.items.length} ▾
          </span>
        </summary>
        <ol className="mt-2 space-y-1 border-t border-line pt-2">
          {nav.items.map((item, n) => (
            <li key={item.id}>
              <Link
                href={`/@${slug}/${item.id}`}
                aria-current={item.id === postId ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-ink/5 ${item.id === postId ? "font-bold text-accent" : ""}`}
              >
                <span className="w-6 shrink-0 text-right text-sm text-ink-soft">{n + 1}</span>
                <span className="min-w-0 truncate">{item.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </details>
      {(prev || next) && (
        <div className="mt-2 flex flex-wrap justify-between gap-2">
          {prev ? (
            <Link href={`/@${slug}/${prev.id}`} className="btn min-w-0 max-w-full text-sm" data-series-prev>
              <span className="truncate">← 이전 편: {prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/@${slug}/${next.id}`} className="btn min-w-0 max-w-full text-sm" data-series-next>
              <span className="truncate">다음 편: {next.title} →</span>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
