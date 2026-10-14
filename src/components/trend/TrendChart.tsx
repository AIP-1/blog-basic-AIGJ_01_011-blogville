"use client";

import { useState } from "react";
import type { TrendSeries } from "@/lib/keyword-trend";

// 검색어 트렌드 겹친 선 그래프 (글쓰기 키워드 도우미·블로그 관리 내 태그 인기 흐름이 같이 쓴다).
// 마우스·손가락을 올리면 그 시점의 단어별 값이 말풍선으로 나온다.

const W = 560;
const H = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 30 };

function shortDate(period: string): string {
  return `${Number(period.slice(5, 7))}/${Number(period.slice(8, 10))}`;
}

export function TrendChart({ series, label }: { series: TrendSeries[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = series[0]?.points.length ?? 0;
  if (n === 0) return null;
  const x = (i: number) => PAD.left + (n === 1 ? 0 : (i / (n - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - v / 100) * (H - PAD.top - PAD.bottom);
  return (
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          role="img"
          aria-label={label}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - box.left) / box.width) * W;
            const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1));
            setHover(Math.max(0, Math.min(n - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
              <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="fill-ink-soft text-[10px]">
                {v}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} className="fill-ink-soft text-[10px]">
            {shortDate(series[0].points[0].period)}
          </text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-ink-soft text-[10px]">
            {shortDate(series[0].points[n - 1].period)}
          </text>
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} className="stroke-ink-soft" strokeWidth={1} strokeDasharray="3 3" />}
          {series.map((s, si) => (
            <g key={s.keyword} className={TREND_STROKE[si]}>
              <polyline fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.points.map((p, i) => `${x(i)},${y(p.ratio)}`).join(" ")} />
              {hover !== null && <circle cx={x(hover)} cy={y(s.points[hover].ratio)} r={4} className={`${TREND_FILL[si]} stroke-surface`} strokeWidth={2} />}
            </g>
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > n / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
            data-keyword-tooltip
          >
            <p className="font-semibold">{series[0].points[hover].period.replaceAll("-", ".")}</p>
            {series.map((s, si) => (
              <p key={s.keyword} className="flex items-center gap-1.5 whitespace-nowrap">
                <span className={`inline-block size-2 rounded-full ${TREND_BG[si]}`} aria-hidden />
                {s.keyword} <span className="ml-auto pl-2 tabular-nums">{Math.round(s.points[hover].ratio)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
  );
}

// Tailwind가 찾을 수 있게 색 클래스를 글자 그대로 둔다 (TREND_COLORS와 같은 값)
export const TREND_STROKE = ["stroke-[#2a78d6] dark:stroke-[#3987e5]", "stroke-[#eb6834] dark:stroke-[#d95926]", "stroke-[#1baf7a] dark:stroke-[#199e70]", "stroke-[#eda100] dark:stroke-[#c98500]", "stroke-[#e87ba4] dark:stroke-[#d55181]"];
export const TREND_FILL = ["fill-[#2a78d6] dark:fill-[#3987e5]", "fill-[#eb6834] dark:fill-[#d95926]", "fill-[#1baf7a] dark:fill-[#199e70]", "fill-[#eda100] dark:fill-[#c98500]", "fill-[#e87ba4] dark:fill-[#d55181]"];
export const TREND_BG = ["bg-[#2a78d6] dark:bg-[#3987e5]", "bg-[#eb6834] dark:bg-[#d95926]", "bg-[#1baf7a] dark:bg-[#199e70]", "bg-[#eda100] dark:bg-[#c98500]", "bg-[#e87ba4] dark:bg-[#d55181]"];
