"use client";

import { useCallback, useEffect, useState } from "react";
import { Time } from "@/components/common/Time";
import { NEWS_TABS, type NewsResult, type NewsTab } from "@/lib/news";
import type { WidgetSize } from "@/lib/widgets";

const REFRESH_MS = 10 * 60_000;

/**
 * 옆 칸 📰 오늘의 뉴스: 분야 탭마다 여러 언론이 많이 다룬 이슈 TOP 5 (작게 3).
 * 제목을 누르면 원문 기사가 새 탭으로 열린다. 화면을 열어 둔 동안 10분마다, [↻]를 누르면 바로 새로 받는다.
 * 첫 화면(종합)은 서버가 그려 보낸다.
 */
export function NewsWidget({ initial, size = "lg" }: { initial: NewsResult | null; size?: WidgetSize }) {
  const [tab, setTab] = useState<NewsTab>("all");
  const [data, setData] = useState<Partial<Record<NewsTab, NewsResult>>>(initial ? { all: initial } : {});
  const [state, setState] = useState<"idle" | "loading" | "error">(initial ? "idle" : "error");

  const load = useCallback(async (t: NewsTab) => {
    setState("loading");
    try {
      const res = await fetch(`/api/news?tab=${t}`);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as NewsResult;
      setData((d) => ({ ...d, [t]: json }));
      setState("idle");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load(tab);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [tab, load]);

  const pick = (t: NewsTab) => {
    setTab(t);
    if (!data[t]) void load(t);
    else setState("idle");
  };

  const current = data[tab];
  const items = current?.items.slice(0, size === "sm" ? 3 : 5) ?? [];
  return (
    <section className="widget" aria-labelledby="w-news" data-widget="news" data-size={size} aria-busy={state === "loading"}>
      <h2 id="w-news" className="widget-title flex items-center gap-2">
        <span className="flex-1">📰 오늘의 뉴스</span>
        {current && (
          <span className="text-xs font-normal text-ink-soft">
            <Time date={current.at} />
          </span>
        )}
        <button type="button" onClick={() => void load(tab)} disabled={state === "loading"} className="btn btn-ghost min-h-9 min-w-9 px-2 text-sm font-normal" aria-label="뉴스 새로 받기" title="새로 받기">
          <span aria-hidden className={state === "loading" ? "inline-block animate-spin" : ""}>
            ↻
          </span>
        </button>
      </h2>
      <div role="tablist" aria-label="뉴스 분야" className="mb-1 flex gap-1 overflow-x-auto px-1 pb-1 text-xs [scrollbar-width:none]">
        {NEWS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => pick(t.key)}
            className={`min-h-8 shrink-0 rounded-full px-2.5 ${tab === t.key ? "bg-ink font-semibold text-surface" : "bg-bg text-ink-soft hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {items.length > 0 ? (
        <ol className="divide-y divide-line" role="tabpanel" aria-label={`${NEWS_TABS.find((t) => t.key === tab)!.label} 이슈`}>
          {items.map((n, i) => (
            <li key={n.url} data-news-item>
              <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="group flex gap-2.5 rounded-lg px-1 py-2 hover:bg-bg">
                <span className={`w-4 shrink-0 text-center font-extrabold tabular-nums ${i < 3 ? "text-accent" : "text-ink-soft"}`}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline">{n.title}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-soft">
                    <span className="truncate">{n.source}</span> · <Time date={n.at} />
                    {n.count >= 3 && <span className="ml-auto shrink-0 rounded-full bg-accent/10 px-1.5 font-semibold text-accent">{n.count}곳 보도</span>}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-1 py-3 text-sm text-ink-soft">{state === "loading" ? "뉴스를 받는 중…" : "뉴스를 불러오지 못했어요"}</p>
      )}
      <p className="mt-1 flex items-center px-1 text-[11px] text-ink-soft">
        <span className="flex-1">네이버 뉴스 검색 · 여러 언론이 많이 다룬 순</span>
        <a href="https://news.naver.com/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center hover:underline">
          더보기 ›
        </a>
      </p>
    </section>
  );
}
