"use client";

import { useState } from "react";
import Link from "next/link";
import { dayTone, HOLIDAYS, monthGrid, shiftMonth, type CalendarMonth } from "@/lib/calendar";
import { weekdayOf } from "@/lib/weather";

// 📅 캘린더 보드: 왼쪽 큰 날짜, 오른쪽 작은 달력 (일요일·공휴일 빨강, 토요일 파랑, 오늘 검은 동그라미, 글 쓴 날 점).
// 날짜를 누르면 그날 쓴 글이 아래에 나온다.
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const RED = "text-[#d32f2f] dark:text-[#ff6b6b]";
const BLUE = "text-[#1565c0] dark:text-[#64a8ff]";

export function CalendarBoard({ slug, today, initial }: { slug: string; today: string; initial: CalendarMonth }) {
  const [months, setMonths] = useState<Record<string, CalendarMonth>>({ [initial.month]: initial });
  const [month, setMonth] = useState(initial.month);
  const [selected, setSelected] = useState(today);
  const [error, setError] = useState(false);
  const data = months[month];

  async function go(by: number) {
    const next = shiftMonth(month, by);
    setMonth(next);
    setError(false);
    if (months[next]) return;
    try {
      const res = await fetch(`/api/calendar?blog=${encodeURIComponent(slug)}&month=${next}`);
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as CalendarMonth;
      setMonths((m) => ({ ...m, [next]: json }));
    } catch {
      setError(true);
    }
  }

  const [, mm, dd] = selected.split("-");
  const posts = months[selected.slice(0, 7)]?.days[selected] ?? [];
  const holiday = HOLIDAYS[selected];
  const [y, m] = month.split("-");

  return (
    <section className="widget" aria-labelledby="w-calendar" data-calendar-widget>
      <div className="flex items-center gap-1 px-2 pb-2 pt-1">
        <h2 id="w-calendar" className="font-bold">
          캘린더
        </h2>
        <div className="ml-auto flex items-center text-sm text-ink-soft">
          <button type="button" onClick={() => void go(-1)} className="grid size-8 place-items-center rounded-full hover:bg-line/40" aria-label="이전 달">
            ‹
          </button>
          <span className="tabular-nums" aria-live="polite" data-calendar-month>
            {y}.{m}
          </span>
          <button type="button" onClick={() => void go(1)} className="grid size-8 place-items-center rounded-full hover:bg-line/40" aria-label="다음 달">
            ›
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-2">
        {/* 큰 날짜 (고른 날, 처음엔 오늘) */}
        <div className="min-w-[6.5rem] flex-1">
          <p className="flex items-baseline gap-1.5" data-calendar-selected={selected}>
            <span className="text-4xl font-bold tabular-nums leading-none">
              {Number(mm)}.{dd}
            </span>
            <span className={`text-sm ${dayTone(selected) === "holiday" ? RED : dayTone(selected) === "saturday" ? BLUE : "text-ink-soft"}`}>{weekdayOf(selected)}</span>
          </p>
          {holiday && <p className={`mt-1 text-sm ${RED}`}>{holiday}</p>}
          {selected !== today && (
            <button type="button" onClick={() => {
                setSelected(today);
                setMonth(today.slice(0, 7));
              }} className="mt-1 text-xs text-ink-soft hover:underline">
              오늘로
            </button>
          )}
        </div>

        {/* 작은 달력 */}
        <table className="w-[15rem] max-w-full shrink-0 table-fixed text-center text-[13px] tabular-nums" aria-label={`${Number(y)}년 ${Number(m)}월`}>
          <thead>
            <tr>
              {WEEK.map((d, i) => (
                <th key={d} scope="col" className={`pb-1 font-semibold ${i === 0 ? RED : i === 6 ? BLUE : ""}`}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chunk(monthGrid(month), 7).map((week) => (
              <tr key={week[0].date}>
                {week.map(({ date, inMonth }) => {
                  const tone = dayTone(date);
                  const count = inMonth ? (data?.days[date]?.length ?? 0) : 0;
                  const isToday = date === today;
                  const isSel = date === selected;
                  const name = HOLIDAYS[date];
                  return (
                    <td key={date} className="p-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(date);
                          // 앞뒤 달 칸을 누르면 그 달로 넘어간다
                          if (!inMonth) void go(date < month ? -1 : 1);
                        }}
                        aria-pressed={isSel}
                        aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일${name ? ` ${name}` : ""}${count ? ` 글 ${count}개` : ""}`}
                        title={name}
                        data-calendar-day={date}
                        data-has-posts={count > 0 || undefined}
                        className={`relative mx-auto grid size-8 place-items-center rounded-full ${
                          isToday ? "bg-ink font-bold text-surface" : isSel ? "ring-2 ring-accent" : "hover:bg-line/40"
                        } ${isToday ? "" : tone === "holiday" ? RED : tone === "saturday" ? BLUE : ""} ${inMonth ? "" : "opacity-40"}`}
                      >
                        {Number(date.slice(8))}
                        {count > 0 && <span className={`absolute bottom-0.5 size-1 rounded-full ${isToday ? "bg-surface" : "bg-accent"}`} aria-hidden />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 고른 날 쓴 글 */}
      <div className="mt-2 border-t border-line px-2 pt-2 text-sm" data-calendar-posts>
        {error ? (
          <p className="text-ink-soft" role="status">
            그 달 글을 받지 못했어요
          </p>
        ) : posts.length === 0 ? (
          <p className="text-ink-soft">이날 쓴 글이 없어요</p>
        ) : (
          <ul className="space-y-1">
            {posts.map((p) => (
              <li key={p.id}>
                <Link href={`/@${slug}/${p.id}`} className="block truncate hover:underline">
                  · {p.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
