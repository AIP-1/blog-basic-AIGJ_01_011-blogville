"use client";

import { useState } from "react";
import { addBlogStock, removeBlogStock, type StockState } from "@/app/settings/blog/actions";
import { STOCK_MAX, type StockItem } from "@/lib/stocks";

/**
 * 블로그 설정의 📈 관심 종목: 이름·코드로 찾아(`/api/stocks/search`, 네이버 증권 검색) [넣기], 넣은 종목은 [빼기].
 * 블로그 홈 옆 칸에 넣은 순서대로 보이고 5초마다 시세가 바뀐다.
 */
export function StockManager({ stocks }: { stocks: (StockItem & { id: number })[] }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<StockState>(null);
  const has = new Set(stocks.map((s) => `${s.market}:${s.code}`));

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setState(null);
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as { items?: StockItem[] };
      setResults(json.items ?? []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function run(action: (f: FormData) => Promise<StockState>, fields: Record<string, string>) {
    if (busy) return;
    setBusy(true);
    try {
      const form = new FormData();
      for (const [k, v] of Object.entries(fields)) form.append(k, v);
      setState(await action(form));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} role="search" className="flex gap-2">
        <input
          type="search"
          aria-label="종목 검색어"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          maxLength={30}
          placeholder="삼성전자, 005930, 애플, AAPL"
          className="field min-w-0 flex-1"
        />
        <button type="submit" className="btn" disabled={searching}>
          {searching ? "찾는 중..." : "종목 찾기"}
        </button>
      </form>

      {results !== null && (
        <div aria-label="검색 결과" role="region">
          {results.length === 0 ? (
            <p className="text-sm text-ink-soft">찾은 종목이 없어요. 국내·미국 주식만 넣을 수 있어요.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {results.map((r) => (
                <li key={`${r.market}:${r.code}`} className="flex min-h-11 items-center gap-2 px-3 py-1.5" data-stock-result={r.code}>
                  <span className="min-w-0 flex-1 truncate">
                    {r.name} <span className="text-sm text-ink-soft">· {r.market === "KR" ? "국내" : "미국"} {r.code}</span>
                  </span>
                  {has.has(`${r.market}:${r.code}`) ? (
                    <span className="text-sm text-ink-soft">넣음</span>
                  ) : (
                    <button
                      type="button"
                      className="btn"
                      disabled={busy || stocks.length >= STOCK_MAX}
                      onClick={() => void run(addBlogStock, { market: r.market, code: r.code, name: r.name })}
                    >
                      넣기
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">
          넣은 종목 {stocks.length}/{STOCK_MAX}
        </h3>
        {stocks.length === 0 ? (
          <p className="text-sm text-ink-soft">아직 없어요. 위에서 찾아 넣으면 블로그 홈 옆 칸에 시세가 보여요.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line" aria-label="넣은 종목">
            {stocks.map((s) => (
              <li key={s.id} className="flex min-h-11 items-center gap-2 px-3 py-1.5" data-my-stock={s.code}>
                <span className="min-w-0 flex-1 truncate">
                  {s.name} <span className="text-sm text-ink-soft">· {s.market === "KR" ? "국내" : "미국"} {s.code}</span>
                </span>
                <button type="button" className="btn" disabled={busy} onClick={() => void run(removeBlogStock, { id: String(s.id) })}>
                  빼기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-sm text-ink-soft">시세는 네이버 증권의 공개 시세예요. 공식 API가 아니라서 네이버 쪽 사정으로 잠시 안 보일 수 있어요.</p>
      {state && "error" in state && (
        <p role="alert" className="form-error">
          {state.error}
        </p>
      )}
      {state && "message" in state && (
        <p role="status" className="font-semibold text-accent">
          {state.message}
        </p>
      )}
    </div>
  );
}
