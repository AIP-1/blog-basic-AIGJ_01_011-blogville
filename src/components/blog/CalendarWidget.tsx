"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { holidayName, monthGrid, monthKey, shiftMonth, todayParts, weekOf, type CalendarMonth } from "@/lib/calendar";
import type { WidgetSize } from "@/lib/widgets";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 옆 칸 📅 캘린더: 글 쓴 날에 점, 누르면 그날 글 목록. 공휴일·일요일은 빨강, 토요일은 파랑.
 * 크게 = 한 달 (이전·다음 달로 넘김), 작게 = 이번 주 한 줄.
 */
export function CalendarWidget({ slug, initial, size }: { slug: string; initial: CalendarMonth; size: WidgetSize }) {
  const today = todayParts();
  const [y0, m0] = initial.month.split("-").map(Number);
  const [view, setView] = useState({ year: y0, month: m0 });
  const [cache, setCache] = useState<Record<string, CalendarMonth>>({ [initial.month]: initial });
  const [picked, setPicked] = useState<{ year: number; month: number; day: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const key = monthKey(view.year, view.month);
  const data = cache[key];

  // 이번 주가 지난달·다음 달에 걸치면 그 달도 받는다
  const week = weekOf(today.year, today.month, today.day);
  const needed = size === "sm" ? [...new Set(week.map((d) => monthKey(d.year, d.month)))] : [key];
  const missing = needed.filter((k) => !cache[k]).join(",");

  useEffect(() => {
    if (!missing) return;
    let stopped = false;
    for (const k of missing.split(",")) {
      fetch(`/api/blogs/${encodeURIComponent(slug)}/calendar?month=${k}`)
        .then((res) => (res.ok ? (res.json() as Promise<CalendarMonth>) : Promise.reject()))
        .then((json) => !stopped && setCache((c) => ({ ...c, [k]: json })))
        .catch(() => !stopped && setFailed(true));
    }
    return () => {
      stopped = true;
    };
  }, [missing, slug]);

  const postsOn = (d: { year: number; month: number; day: number }) => cache[monthKey(d.year, d.month)]?.days[d.day] ?? [];
  const go = (delta: number) => {
    setView((v) => shiftMonth(v.year, v.month, delta));
    setPicked(null);
    setFailed(false);
  };

  const cell = (d: { year: number; month: number; day: number }, col: number) => {
    const list = postsOn(d);
    const holiday = holidayName(d.year, d.month, d.day);
    const isToday = d.year === today.year && d.month === today.month && d.day === today.day;
    const isPicked = picked && picked.year === d.year && picked.month === d.month && picked.day === d.day;
    const tone = holiday || col === 0 ? "text-[#d32f2f] dark:text-[#ff6b6b]" : col === 6 ? "text-[#1565c0] dark:text-[#64a8ff]" : "";
    const label = `${d.month}월 ${d.day}일${holiday ? ` ${holiday}` : ""}${list.length ? `, 글 ${list.length}개` : ""}${isToday ? ", 오늘" : ""}`;
    return (
      <button
        type="button"
        aria-label={label}
        title={holiday ?? undefined}
        aria-pressed={list.length ? !!isPicked : undefined}
        disabled={list.length === 0}
        onClick={() => setPicked(isPicked ? null : d)}
        data-calendar-day={d.day}
        data-has-posts={list.length > 0 || undefined}
        className={`relative flex aspect-square min-h-9 w-full flex-col items-center justify-center rounded-lg text-sm tabular-nums transition ${tone} ${
          isPicked ? "bg-accent text-surface" : isToday ? "font-extrabold ring-2 ring-accent ring-inset" : ""
        } ${list.length ? "cursor-pointer font-semibold hover:bg-bg" : "cursor-default"}`}
      >
        {d.day}
        {list.length > 0 && <span aria-hidden className={`absolute bottom-1 size-1.5 rounded-full ${isPicked ? "bg-surface" : "bg-accent"}`} />}
      </button>
    );
  };

  const pickedPosts = picked ? postsOn(picked) : [];

  return (
    <section className="widget" aria-labelledby="w-calendar" data-widget="calendar" data-size={size}>
      <h2 id="w-calendar" className="widget-title flex items-center gap-1">
        <span className="flex-1">📅 {size === "sm" ? "이번 주" : `${view.year}년 ${view.month}월`}</span>
        {size === "lg" && (
          <>
            <button type="button" className="btn btn-ghost min-h-9 min-w-9 px-2 text-sm" aria-label="이전 달" onClick={() => go(-1)}>
              ‹
            </button>
            {(view.year !== today.year || view.month !== today.month) && (
              <button type="button" className="btn btn-ghost min-h-9 px-2 text-xs" onClick={() => go((today.year - view.year) * 12 + today.month - view.month)}>
                오늘
              </button>
            )}
            <button type="button" className="btn btn-ghost min-h-9 min-w-9 px-2 text-sm" aria-label="다음 달" onClick={() => go(1)}>
              ›
            </button>
          </>
        )}
      </h2>
      <div className="grid grid-cols-7 gap-0.5 px-1 text-center" role="grid" aria-label={size === "sm" ? "이번 주" : `${view.year}년 ${view.month}월`}>
        {WEEKDAYS.map((w, i) => (
          <span key={w} role="columnheader" className={`pb-1 text-xs font-semibold ${i === 0 ? "text-[#d32f2f] dark:text-[#ff6b6b]" : i === 6 ? "text-[#1565c0] dark:text-[#64a8ff]" : "text-ink-soft"}`}>
            {w}
          </span>
        ))}
        {size === "sm"
          ? week.map((d, i) => (
              <span key={i} role="gridcell">
                {cell(d, i)}
              </span>
            ))
          : monthGrid(view.year, view.month).flatMap((row, r) =>
              row.map((day, i) => (
                <span key={`${r}-${i}`} role="gridcell">
                  {day === null ? null : cell({ year: view.year, month: view.month, day }, i)}
                </span>
              )),
            )}
      </div>
      {!data && size === "lg" && !failed && <p className="px-1 pt-2 text-xs text-ink-soft">불러오는 중…</p>}
      {failed && <p className="px-1 pt-2 text-xs text-ink-soft">달력을 불러오지 못했어요</p>}
      {picked && (
        <div className="mt-2 border-t border-line pt-2" data-calendar-posts>
          <p className="px-1 text-xs font-semibold text-ink-soft">
            {picked.month}월 {picked.day}일에 쓴 글
          </p>
          <ul>
            {pickedPosts.map((p) => (
              <li key={p.id}>
                <Link href={`/@${slug}/${p.id}`} className="flex min-h-11 items-center rounded-lg px-2 text-sm hover:bg-bg">
                  <span className="min-w-0 truncate">{p.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
