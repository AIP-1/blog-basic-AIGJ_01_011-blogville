"use client";

import { useState, useTransition } from "react";
import { compareKeywords } from "@/app/write/trend-actions";
import {
  bestKeyword,
  parseKeywords,
  summarizeTrend,
  TREND_KEYWORD_MAX,
  TREND_MESSAGES,
  TREND_PERIODS,
  type TrendPeriod,
  type TrendResult,
  type TrendSeries,
} from "@/lib/keyword-trend";
import { TREND_BG, TrendChart } from "@/components/trend/TrendChart";

// 🔎 글쓰기 키워드 도우미: 제목·태그 후보를 넣으면 네이버 검색 관심도를 겹친 선 그래프로 비교한다.
// "태그에 넣기"로 고른 단어를 태그 칸에 바로 더한다.

type Props = {
  /** 지금 태그 칸 값 (쉼표로 구분) */
  tags: string;
  /** 단어를 태그 칸에 더한다 */
  onAddTag: (keyword: string) => void;
};


export function KeywordHelper({ tags, onAddTag }: Props) {
  const [input, setInput] = useState("");
  const [period, setPeriod] = useState<TrendPeriod>("m3");
  const [result, setResult] = useState<TrendResult | null>(null);
  const [problem, setProblem] = useState("");
  const [pending, start] = useTransition();

  const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

  function run(nextPeriod = period) {
    const keywords = parseKeywords(input);
    if (!keywords) {
      setProblem(TREND_MESSAGES.invalid);
      return;
    }
    setProblem("");
    start(async () => {
      const r = await compareKeywords(keywords, nextPeriod);
      setResult(r);
      if (r.status !== "ok") setProblem(r.status === "invalid" ? TREND_MESSAGES.invalid : TREND_MESSAGES[r.status]);
    });
  }

  return (
    <details className="rounded-xl border border-line bg-surface" data-keyword-helper>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 font-semibold">
        <span aria-hidden>🔎</span> 키워드 도우미
        <span className="text-sm font-normal text-ink-soft">사람들이 네이버에서 더 많이 찾는 말로 제목·태그 정하기</span>
      </summary>
      <div className="grid gap-3 border-t border-line p-3">
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="비교할 단어"
            className="field min-w-0 flex-1"
            placeholder={`비교할 단어를 쉼표로 (${TREND_KEYWORD_MAX}개까지)  예: 가을 캠핑, 캠핑 장비`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                run();
              }
            }}
          />
          {tagList.length > 0 && (
            <button type="button" className="btn" onClick={() => setInput(tagList.slice(0, TREND_KEYWORD_MAX).join(", "))}>
              태그 가져오기
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => run()} disabled={pending}>
            {pending ? "비교하는 중…" : "비교하기"}
          </button>
        </div>
        <div className="flex items-center gap-1 text-sm" role="group" aria-label="기간">
          {TREND_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={period === p.key}
              className={`rounded-full px-3 py-1 ${period === p.key ? "bg-ink font-semibold text-surface" : "text-ink-soft hover:bg-bg"}`}
              onClick={() => {
                setPeriod(p.key);
                if (result?.status === "ok") run(p.key);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {problem && (
          <p role="status" className="text-sm text-ink-soft" data-keyword-problem>
            {problem}
          </p>
        )}
        {result?.status === "ok" && <TrendView series={result.series} tags={tagList} onAddTag={onAddTag} />}
        <p className="text-xs text-ink-soft">네이버 데이터랩 검색어 트렌드 · 기간 안에서 가장 많이 찾은 때를 100으로 둔 상대값이에요 (검색 횟수가 아니에요)</p>
      </div>
    </details>
  );
}

function TrendView({ series, tags, onAddTag }: { series: TrendSeries[]; tags: string[]; onAddTag: (k: string) => void }) {
  const summary = summarizeTrend(series);
  const best = bestKeyword(summary);
  const n = series[0]?.points.length ?? 0;
  if (n === 0 || !best) return <p className="text-sm text-ink-soft">{TREND_MESSAGES.empty}</p>;

  const hasTag = (k: string) => tags.some((t) => t.toLowerCase() === k.toLowerCase());

  return (
    <div className="grid gap-3" data-keyword-result>
      <p className="font-semibold">
        지금 비교한 말 중 가장 많이 찾는 말은 <span className="text-accent">“{best}”</span>예요
      </p>
      <TrendChart series={series} label={`검색 관심도 그래프: ${summary.map((s) => `${s.keyword} 평균 ${s.average}`).join(", ")}`} />
      <ul className="grid gap-1" aria-label="단어별 검색 관심도">
        {summary.map((s, si) => (
          <li key={s.keyword} className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg px-2 hover:bg-bg" data-keyword-row={s.keyword}>
            <span className={`inline-block h-0.5 w-4 rounded-full ${TREND_BG[si]}`} aria-hidden />
            <span className="font-semibold">{s.keyword}</span>
            <span className="text-sm text-ink-soft">평균 {s.average}</span>
            <span className="text-sm text-ink-soft">
              {s.change === "up" ? "↑ 요즘 늘고 있어요" : s.change === "down" ? "↓ 요즘 줄고 있어요" : "→ 비슷해요"}
              {s.changePct !== null && s.change !== "flat" ? ` (${s.changePct > 0 ? "+" : ""}${s.changePct}%)` : ""}
            </span>
            <button type="button" className="btn ml-auto text-sm" disabled={hasTag(s.keyword)} onClick={() => onAddTag(s.keyword)}>
              {hasTag(s.keyword) ? "태그에 있어요" : "태그에 넣기"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
