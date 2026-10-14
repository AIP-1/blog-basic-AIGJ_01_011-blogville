"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatChange, formatPrice, STOCK_REFRESH_MS, type StockQuote } from "@/lib/stocks";
import type { WidgetSize } from "@/lib/widgets";

/**
 * 블로그 옆 칸 📈 관심 종목: 실시간 스트림(/api/stocks/stream, SSE)으로 서버가 시세가 바뀔 때마다 바로 보내 준다.
 * 끊기면 EventSource가 저절로 다시 붙고, 그동안은 마지막 시세를 그대로 두며 20초 넘게 소식이 없으면 한 번 직접 묻는다.
 * 탭이 숨으면 연결을 닫았다가 돌아오면 다시 연다. 가격이 바뀌면 그 칸이 잠깐 빨강(오름)·파랑(내림)으로 깜빡인다.
 * 첫 시세는 서버가 그려 보낸다. 오르면 빨강 ▲, 내리면 파랑 ▼ (국내 증권 화면 관례).
 */
export function StockWidget({ slug, initial, isOwner, size = "lg" }: { slug: string; initial: StockQuote[]; isOwner: boolean; size?: WidgetSize }) {
  const [quotes, setQuotes] = useState(initial);
  const [at, setAt] = useState<Date | null>(null);
  const [live, setLive] = useState<"connecting" | "live" | "paused">("connecting");
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const prev = useRef(new Map(initial.map((q) => [`${q.market}:${q.code}`, q.price])));

  useEffect(() => {
    if (initial.length === 0) return;
    let source: EventSource | null = null;
    let lastMessage = Date.now();
    let flashTimer: ReturnType<typeof setTimeout> | undefined;

    const apply = (next: StockQuote[]) => {
      const changed: Record<string, "up" | "down"> = {};
      for (const q of next) {
        const k = `${q.market}:${q.code}`;
        const before = prev.current.get(k);
        if (before != null && q.price != null && q.price !== before) changed[k] = q.price > before ? "up" : "down";
        prev.current.set(k, q.price);
      }
      setQuotes(next);
      setAt(new Date());
      if (Object.keys(changed).length) {
        setFlash(changed);
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => setFlash({}), 900);
      }
    };

    const open = () => {
      if (source) return;
      setLive("connecting");
      source = new EventSource(`/api/stocks/stream?blog=${encodeURIComponent(slug)}`);
      source.onopen = () => setLive("live");
      source.onmessage = (e) => {
        lastMessage = Date.now();
        setLive("live");
        try {
          apply((JSON.parse(e.data) as { quotes: StockQuote[] }).quotes);
        } catch {}
      };
      // EventSource가 알아서 다시 붙는다. 서버가 아예 닫으면(CLOSED) 잠시 뒤 새로 연다
      source.onerror = () => {
        setLive("connecting");
        if (source?.readyState === EventSource.CLOSED) {
          source = null;
          setTimeout(() => document.visibilityState === "visible" && open(), 3_000);
        }
      };
    };
    const close = () => {
      source?.close();
      source = null;
      setLive("paused");
    };
    // 스트림이 조용하면(프록시가 막는 등) 한 번 직접 묻는다
    const watchdog = setInterval(async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastMessage < 20_000) return;
      lastMessage = Date.now();
      try {
        const res = await fetch(`/api/stocks/quotes?blog=${encodeURIComponent(slug)}`, { cache: "no-store" });
        if (res.ok) apply(((await res.json()) as { quotes: StockQuote[] }).quotes);
      } catch {}
    }, STOCK_REFRESH_MS);
    const onVisible = () => (document.visibilityState === "visible" ? open() : close());

    if (document.visibilityState === "visible") open();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(watchdog);
      clearTimeout(flashTimer);
      document.removeEventListener("visibilitychange", onVisible);
      source?.close();
    };
  }, [slug, initial.length]);

  const toneOf = (change: number | null) =>
    change === null || change === 0 ? "text-ink-soft" : change > 0 ? "text-[#d32f2f] dark:text-[#ff6b6b]" : "text-[#1565c0] dark:text-[#64a8ff]";
  const flashOf = (k: string) =>
    flash[k] === "up" ? "bg-[#d32f2f]/15 dark:bg-[#ff6b6b]/20" : flash[k] === "down" ? "bg-[#1565c0]/15 dark:bg-[#64a8ff]/20" : "bg-transparent";

  return (
    <section className="widget" aria-labelledby="w-stocks" data-stock-widget data-widget="stocks" data-size={size}>
      <h2 id="w-stocks" className="widget-title flex items-center gap-2">
        <span>📈 관심 종목</span>
        {quotes.length > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-normal text-ink-soft" data-stock-live={live}>
            <span aria-hidden className={`size-2 rounded-full ${live === "live" ? "animate-pulse bg-[#2e7d32]" : live === "connecting" ? "bg-[#f9a825]" : "bg-line"}`} />
            {live === "live" ? "실시간" : live === "connecting" ? "연결 중" : "쉬는 중"}
          </span>
        )}
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
            const k = `${q.market}:${q.code}`;
            const closed = q.status !== null && q.status !== "OPEN";
            return (
              <li key={k} className={`flex items-center gap-2 px-1 ${size === "sm" ? "min-h-9 py-1" : "min-h-11 py-1.5"}`} data-stock={q.code}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{q.name}</span>
                  {size === "lg" && (
                    <span className="block text-xs text-ink-soft">
                      {q.market === "KR" ? "국내" : "미국"} · {q.code}
                      {closed && " · 장 마감"}
                    </span>
                  )}
                </span>
                {q.price === null ? (
                  <span className="shrink-0 text-sm text-ink-soft">시세를 못 받았어요</span>
                ) : size === "sm" ? (
                  <span className={`shrink-0 rounded-md px-1.5 text-right text-sm font-bold tabular-nums transition-colors duration-700 ${toneOf(q.change)} ${flashOf(k)}`} data-stock-change>
                    {q.rate === null ? "" : `${q.rate > 0 ? "+" : ""}${q.rate.toFixed(2)}%`}
                  </span>
                ) : (
                  <span className={`shrink-0 rounded-md px-1.5 text-right tabular-nums transition-colors duration-700 ${flashOf(k)}`}>
                    <span className="block font-bold" data-stock-price>
                      {q.currency === "USD" && "$"}
                      {formatPrice(q.price, q.currency)}
                    </span>
                    <span className={`block text-xs ${toneOf(q.change)}`} data-stock-change>
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
          네이버 증권 시세{at && ` · ${at.toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })}`}
        </p>
      )}
    </section>
  );
}
