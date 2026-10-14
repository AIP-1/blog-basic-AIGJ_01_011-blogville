"use client";

import Link from "next/link";
import { TREND_BG, TrendChart } from "@/components/trend/TrendChart";
import { bestKeyword, peakMonth, recentChange, seasonHint, summarizeTrend, TREND_MESSAGES, type TrendResult } from "@/lib/keyword-trend";

/**
 * 블로그 관리 → 📊 내 태그 인기 흐름: 내가 많이 쓴 태그 5개의 최근 1년 네이버 검색 관심도.
 * 태그마다 요즘 흐름(↑↓→)과 가장 많이 찾는 달, 그 달이 이번 달·다음 달이면 "지금 쓰기 좋은 때"를 알려 준다.
 */
export function TagTrend({ slug, tags, trend, thisMonth }: { slug: string; tags: string[]; trend: TrendResult | null; thisMonth: number }) {
  if (tags.length === 0)
    return <p className="text-sm text-ink-soft">아직 태그를 단 글이 없어요. 글에 태그를 달면 그 태그를 사람들이 언제 많이 찾는지 보여 드려요.</p>;
  if (!trend || trend.status !== "ok") {
    const msg = trend ? TREND_MESSAGES[trend.status] : TREND_MESSAGES.error;
    return <p className="text-sm text-ink-soft">{msg}</p>;
  }
  const summary = summarizeTrend(trend.series);
  const best = bestKeyword(summary);
  if (!best) return <p className="text-sm text-ink-soft">{TREND_MESSAGES.empty}</p>;
  const rows = trend.series.map((s, i) => {
    const peak = peakMonth(s.points);
    // 1년 그래프라 "요즘"은 최근 4주와 그 전 4주를 견준다
    return { ...summary[i], ...recentChange(s.points, 4), peak, hint: seasonHint(peak, thisMonth) };
  });
  const timely = rows.filter((r) => r.hint || r.change === "up");
  return (
    <div className="grid gap-3" data-tag-trend>
      <p className="text-sm text-ink-soft">내 블로그에서 가장 많이 쓴 태그 {tags.length}개를 사람들이 네이버에서 얼마나 찾는지 최근 1년 흐름이에요.</p>
      {timely.length > 0 && (
        <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm font-semibold" data-tag-trend-tip>
          ✍️ 지금 쓰기 좋은 글감: {timely.map((r) => `#${r.keyword}`).join(" ")}
        </p>
      )}
      <TrendChart series={trend.series} label={`내 태그 검색 관심도: ${rows.map((r) => `${r.keyword} 평균 ${r.average}`).join(", ")}`} />
      <ul className="grid gap-1" aria-label="태그별 흐름">
        {rows.map((r, i) => (
          <li key={r.keyword} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 hover:bg-bg" data-tag-trend-row={r.keyword}>
            <span className={`inline-block h-0.5 w-4 rounded-full ${TREND_BG[i]}`} aria-hidden />
            <Link href={`/@${slug}?tag=${encodeURIComponent(r.keyword)}`} className="font-semibold hover:underline">
              #{r.keyword}
            </Link>
            <span className="text-sm text-ink-soft">
              {r.change === "up" ? "↑ 최근 한 달 늘고 있어요" : r.change === "down" ? "↓ 최근 한 달 줄고 있어요" : "→ 최근 한 달 비슷해요"}
              {r.changePct !== null && r.change !== "flat" ? ` (${r.changePct > 0 ? "+" : ""}${r.changePct}%)` : ""}
            </span>
            {r.peak && (
              <span className="text-sm text-ink-soft">
                · {r.peak}월에 가장 많이 찾아요
                {r.hint === "now" && <span className="ml-1 font-semibold text-accent">(바로 지금!)</span>}
                {r.hint === "soon" && <span className="ml-1 font-semibold text-accent">(다음 달)</span>}
              </span>
            )}
            {r.keyword === best && <span className="ml-auto rounded-full bg-accent/10 px-2 text-xs font-semibold text-accent">가장 많이 찾는 태그</span>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-soft">네이버 데이터랩 검색어 트렌드 · 1년 안에서 가장 많이 찾은 때를 100으로 둔 상대값이에요 (검색 횟수가 아니에요). 하루에 몇 번만 새로 받아요.</p>
    </div>
  );
}
