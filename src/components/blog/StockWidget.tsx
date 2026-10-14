"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatChange, formatPrice, STOCK_REFRESH_MS, type StockQuote } from "@/lib/stocks";

/**
 * 블로그 옆 칸 📈 관심 종목: 화면을 열어 둔 동안 5초마다 시세를 새로 받는다 (탭이 숨으면 쉬었다가 돌아오면 바로 받는다).
 * 첫 시세는 서버가 그려 보낸다. 오르면 빨강 ▲, 내리면 파랑 ▼ (국내 증권 화면 관례).
 */
export function StockWidget({ slug, initial, isOwner }: { slug: string; initial: StockQuote[]; isOwner: boolean }) {
  const [quotes, setQuotes] = useState(initial);
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    if (initial.length === 0) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(`/api/stocks/quotes?blog=${encodeURIComponent(slug)}`, { cache: "no-store" });
          if (res.ok) {
            const json = (await res.json()) as { quotes: StockQuote[] };
            if (!stopped) {
              setQuotes(json.quotes);
              setAt(new Date());
            }
          }
        } catch {
          // 잠깐 끊기면 다음 차례에 다시 받는다
        }
      }
      if (!stopped) timer = setTimeout(load, STOCK_REFRESH_MS);
    }
    timer = setTimeout(load, STOCK_REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slug, initial.length]);

  return (
    <section className="widget" aria-labelledby="w-stocks" data-stock-widget>
      <h2 id="w-stocks" className="widget-title flex items-center gap-2">
        📈 관심 종목
        {isOwner && (
          <Link href="/settings/blog#stocks" className="ml-auto text-sm font-normal text-ink-soft hover:underline">
            종목 바꾸기
          </Link>
        )}
      </h2>
      {quotes.length === 0 ? (
        <p className="px-1 text-sm text-ink-soft">블로그 설정에서 종목을 넣어 보세요</p>
      ) : (
        <ul className="divide-y divide-line">
          {quotes.map((q) => {
            const tone = q.change === null || q.change === 0 ? "text-ink-soft" : q.change > 0 ? "text-[#d32f2f] dark:text-[#ff6b6b]" : "text-[#1565c0] dark:text-[#64a8ff]";
            return (
              <li key={`${q.market}:${q.code}`} className="flex min-h-11 items-center gap-2 px-1 py-1.5" data-stock={q.code}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{q.name}</span>
                  <span className="block text-xs text-ink-soft">
                    {q.market === "KR" ? "국내" : "미국"} · {q.code}
                  </span>
                </span>
                {q.price === null ? (
                  <span className="shrink-0 text-sm text-ink-soft">시세를 못 받았어요</span>
                ) : (
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block font-bold" data-stock-price>
                      {q.currency === "USD" && "$"}
                      {formatPrice(q.price, q.currency)}
                    </span>
                    <span className={`block text-xs ${tone}`} data-stock-change>
                      {formatChange(q.change, q.rate, q.currency)}
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {quotes.length > 0 && (
        <p className="mt-2 px-1 text-xs text-ink-soft" aria-live="off">
          네이버 증권 시세 · 5초마다 새로 받아요{at && ` · ${at.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`}
        </p>
      )}
    </section>
  );
}
