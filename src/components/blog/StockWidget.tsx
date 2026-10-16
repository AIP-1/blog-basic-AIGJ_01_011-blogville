"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatChange, formatPrice, STOCK_INDEXES, STOCK_REFRESH_MS, STOCK_SESSION_LABELS, type StockIndex, type StockIndexCode, type StockQuote } from "@/lib/stocks";
import type { WidgetSize } from "@/lib/widgets";

const UP = "text-[#d32f2f] dark:text-[#ff6b6b]";
const DOWN = "text-[#1565c0] dark:text-[#64a8ff]";
const toneOf = (change: number | null) => (change === null || change === 0 ? "text-ink-soft" : change > 0 ? UP : DOWN);
const rateText = (rate: number | null) => (rate === null ? "" : `${rate > 0 ? "▲" : rate < 0 ? "▼" : ""}${Math.abs(rate).toFixed(2)}%`);

type Payload = { quotes: StockQuote[]; index?: StockIndex };

/** 지수 하루 흐름: 전날 종가(점선)보다 위면 빨강, 아래면 파랑 영역 */
function IndexChart({ points, base, up }: { points: number[]; base: number | null; up: boolean }) {
  if (points.length < 2) return <div className="h-14" />;
  const lo = Math.min(...points, base ?? Infinity);
  const hi = Math.max(...points, base ?? -Infinity);
  const span = hi - lo || 1;
  const W = 120;
  const H = 40;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - ((v - lo) / span) * (H - 2) - 1;
  const line = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const color = up ? "#e53935" : "#1e88e5";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-14 w-full" aria-hidden data-stock-index-chart>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill={color} fillOpacity="0.15" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      {base !== null && <line x1="0" x2={W} y1={y(base)} y2={y(base)} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

/**
 * 블로그 옆 칸 📈 증시: 왼쪽(넓으면)·위(좁으면)에 코스피·코스닥 지수와 오늘 흐름, 옆에 블로그 관심 종목 (네이버 메인 증시 위젯 모양).
 * 실시간 스트림(/api/stocks/stream, SSE)으로 서버가 시세가 바뀔 때마다 바로 보내 준다. 끊기면 EventSource가 저절로 다시 붙고,
 * 그동안은 마지막 시세를 그대로 두며 20초 넘게 소식이 없으면 한 번 직접 묻는다. 탭이 숨으면 연결을 닫았다가 돌아오면 다시 연다.
 * 가격이 바뀌면 그 칸이 잠깐 빨강(오름)·파랑(내림)으로 깜빡인다. 첫 시세는 서버가 그려 보낸다.
 */
export function StockWidget({
  slug,
  initial,
  initialIndex,
  isOwner,
  size = "lg",
}: {
  slug: string;
  initial: StockQuote[];
  initialIndex: StockIndex;
  isOwner: boolean;
  size?: WidgetSize;
}) {
  const [quotes, setQuotes] = useState(initial);
  const [index, setIndex] = useState(initialIndex);
  const [indexCode, setIndexCode] = useState<StockIndexCode>(initialIndex.code);
  const [at, setAt] = useState<Date | null>(null);
  const [live, setLive] = useState<"connecting" | "live" | "paused">("connecting");
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const prev = useRef(new Map<string, number | null>([...initial.map((q) => [`${q.market}:${q.code}`, q.price] as const), [`IDX:${initialIndex.code}`, initialIndex.price]]));

  useEffect(() => {
    let source: EventSource | null = null;
    let lastMessage = Date.now();
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    const query = `blog=${encodeURIComponent(slug)}&index=${indexCode}`;

    const apply = ({ quotes: next, index: nextIndex }: Payload) => {
      const changed: Record<string, "up" | "down"> = {};
      const rows: [string, number | null][] = next.map((q) => [`${q.market}:${q.code}`, q.price]);
      if (nextIndex) rows.push([`IDX:${nextIndex.code}`, nextIndex.price]);
      for (const [k, price] of rows) {
        const before = prev.current.get(k);
        if (before != null && price != null && price !== before) changed[k] = price > before ? "up" : "down";
        prev.current.set(k, price);
      }
      setQuotes(next);
      if (nextIndex) setIndex(nextIndex);
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
      source = new EventSource(`/api/stocks/stream?${query}`);
      source.onopen = () => setLive("live");
      source.onmessage = (e) => {
        lastMessage = Date.now();
        setLive("live");
        try {
          apply(JSON.parse(e.data) as Payload);
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
        const res = await fetch(`/api/stocks/quotes?${query}`, { cache: "no-store" });
        if (res.ok) apply((await res.json()) as Payload);
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
  }, [slug, indexCode]);

  const flashOf = (k: string) =>
    flash[k] === "up" ? "bg-[#d32f2f]/15 dark:bg-[#ff6b6b]/20" : flash[k] === "down" ? "bg-[#1565c0]/15 dark:bg-[#64a8ff]/20" : "bg-transparent";
  const base = index.price !== null && index.change !== null ? index.price - index.change : null;
  const points = index.price !== null && index.chart.length ? [...index.chart, index.price] : index.chart;
  const time = (at ?? new Date()).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const date = (at ?? new Date()).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit" }).replace(/\s/g, "");

  return (
    <section className="widget @container" aria-labelledby="w-stocks" data-stock-widget data-widget="stocks" data-size={size}>
      <h2 id="w-stocks" className="widget-title flex items-center gap-2">
        <span className="flex-1">📈 증시</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-normal text-ink-soft" data-stock-live={live}>
          <span suppressHydrationWarning>
            {date} {time}
          </span>
          <span aria-hidden className={`size-2 rounded-full ${live === "live" ? "animate-pulse bg-[#2e7d32]" : live === "connecting" ? "bg-[#f9a825]" : "bg-line"}`} />
          <span className="sr-only">{live === "live" ? "실시간" : live === "connecting" ? "연결 중" : "쉬는 중"}</span>
        </span>
      </h2>

      <div className={`grid gap-3 px-1 ${size === "lg" ? "@md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" : ""}`}>
        {/* 지수 */}
        <div className="min-w-0" data-stock-index={index.code}>
          <div role="tablist" aria-label="지수" className="mb-1 inline-flex gap-1 text-xs">
            {STOCK_INDEXES.map((i) => (
              <button
                key={i.code}
                type="button"
                role="tab"
                aria-selected={indexCode === i.code}
                onClick={() => setIndexCode(i.code)}
                className={`min-h-8 rounded-full px-2.5 ${indexCode === i.code ? "bg-ink font-semibold text-surface" : "text-ink-soft hover:bg-bg"}`}
              >
                {i.name}
              </button>
            ))}
          </div>
          {index.price === null ? (
            <p className="py-2 text-sm text-ink-soft">지수를 못 받았어요</p>
          ) : (
            <div className={`rounded-md transition-colors duration-700 ${flashOf(`IDX:${index.code}`)}`}>
              <p className={`font-extrabold tabular-nums ${size === "lg" ? "text-2xl" : "text-lg"}`} data-stock-index-price>
                {index.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className={`text-sm font-semibold tabular-nums ${toneOf(index.change)}`}>
                {index.change !== null && index.change !== 0 && (index.change > 0 ? "▲" : "▼")}
                {index.change !== null && Math.abs(index.change).toFixed(2)} {index.rate !== null && `${index.rate > 0 ? "+" : ""}${index.rate.toFixed(2)}%`}
                {index.status !== null && index.status !== "OPEN" && <span className="ml-1 text-xs font-normal text-ink-soft">장 마감</span>}
              </p>
            </div>
          )}
          {size === "lg" && <IndexChart points={points} base={base} up={(index.change ?? 0) >= 0} />}
        </div>

        {/* 관심 종목 */}
        <div className="min-w-0">
          {quotes.length === 0 ? (
            isOwner && <p className="py-2 text-sm text-ink-soft">블로그 설정에서 종목을 넣어 보세요</p>
          ) : (
            <ul className="divide-y divide-line">
              {quotes.map((q) => {
                const k = `${q.market}:${q.code}`;
                const closed = q.status !== null && q.status !== "OPEN" && !q.session;
                return (
                  <li key={k} className={`flex items-center gap-2 ${size === "sm" ? "min-h-9 py-1" : "min-h-11 py-1.5"}`} data-stock={q.code} title={`${q.market === "KR" ? "국내" : "미국"} · ${q.code}${closed ? " · 장 마감" : ""}`}>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{q.name}</span>
                    {q.price === null ? (
                      <span className="shrink-0 text-xs text-ink-soft">시세를 못 받았어요</span>
                    ) : (
                      <span className={`flex shrink-0 items-baseline gap-2 rounded-md px-1 tabular-nums transition-colors duration-700 ${flashOf(k)}`}>
                        {q.session && (
                          <span className="rounded border border-line px-1 text-[10px] font-semibold text-ink-soft" data-stock-session={q.session} title={`${STOCK_SESSION_LABELS[q.session]}마켓 가격 (정규장 밖 거래)`}>
                            {STOCK_SESSION_LABELS[q.session]}
                          </span>
                        )}
                        <span className={`text-xs font-semibold ${toneOf(q.change)}`} data-stock-rate>
                          {rateText(q.rate)}
                        </span>
                        {size === "lg" && (
                          <span className="text-sm font-bold" data-stock-price>
                            {q.currency === "USD" && "$"}
                            {formatPrice(q.price, q.currency)}
                          </span>
                        )}
                        <span className="sr-only" data-stock-change>
                          {formatChange(q.change, q.rate, q.currency)}
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {isOwner && (
            <Link href="/settings/blog#stocks" className="flex min-h-11 items-center justify-between border-t border-line text-sm text-ink-soft hover:text-ink">
              관심 종목 바꾸기 <span aria-hidden>›</span>
            </Link>
          )}
        </div>
      </div>
      <p className="mt-1 px-1 text-[11px] text-ink-soft">네이버 증권 시세 · 실시간</p>
    </section>
  );
}
