import "server-only";
import { krakenPair, parseKrakenTicker } from "@/lib/stocks";

// 📈 미국 주식 데이마켓 시간(한국 낮)의 참고 가격: 크라켄이 24시간 거래하는 주식 토큰(xStocks, 예: MUx)의 공개 시세.
// 계좌·열쇠 없이 받는다. 실제 주식이 아니라 주식을 따라가는 토큰이라 조금 다를 수 있다.
// 시험은 KRAKEN_API_BASE로 가짜 서버를 가리킨다.
const BASE = () => process.env.KRAKEN_API_BASE ?? "https://api.kraken.com";
const TIMEOUT_MS = 3_000;
// 여러 화면·종목이 물어도 크라켄에는 5초에 한 번, 한꺼번에 묻는다
const TICKER_TTL_MS = 5_000;
// 크라켄에 있는 토큰 목록은 하루 기억한다
const PAIRS_TTL_MS = 24 * 3_600_000;

let pairs: { at: number; value: Promise<Set<string>> } | null = null;

function knownPairs(): Promise<Set<string>> {
  if (pairs && Date.now() - pairs.at < PAIRS_TTL_MS) return pairs.value;
  const value = fetch(`${BASE()}/0/public/AssetPairs?aclass_base=tokenized_asset`, { signal: AbortSignal.timeout(TIMEOUT_MS * 2), cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((json: { result?: Record<string, { altname?: string }> } | null) => new Set(Object.values(json?.result ?? {}).map((p) => p.altname ?? "")))
    .catch(() => new Set<string>());
  pairs = { at: Date.now(), value };
  // 못 받았으면 1분 뒤 다시
  void value.then((set) => {
    if (set.size === 0 && pairs?.value === value) pairs = { at: Date.now() - PAIRS_TTL_MS + 60_000, value };
  });
  return value;
}

const tickerCache = new Map<string, { at: number; value: Promise<Map<string, number>> }>();

/** 미국 종목들(네이버 로이터 코드)의 크라켄 토큰 가격. 크라켄에 없는 종목은 빠진다 */
export async function getTokenPrices(codes: string[]): Promise<Map<string, number>> {
  const known = await knownPairs();
  const wanted = [...new Set(codes.map((c) => [c, krakenPair(c)] as const).filter(([, p]) => p && known.has(p)))] as [string, string][];
  if (wanted.length === 0) return new Map();
  const key = wanted.map(([, p]) => p).sort().join(",");
  let hit = tickerCache.get(key);
  if (!hit || Date.now() - hit.at >= TICKER_TTL_MS) {
    const value = fetch(`${BASE()}/0/public/Ticker?pair=${key}&asset_class=tokenized_asset`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { error?: unknown[]; result?: Record<string, unknown> } | null) => {
        const out = new Map<string, number>();
        const result = json?.result ?? {};
        for (const [code, pair] of wanted) {
          const price = parseKrakenTicker(result[pair]);
          if (price !== null) out.set(code, price);
        }
        return out;
      })
      .catch(() => new Map<string, number>());
    hit = { at: Date.now(), value };
    tickerCache.set(key, hit);
    if (tickerCache.size > 500) for (const [k, v] of tickerCache) if (Date.now() - v.at >= TICKER_TTL_MS) tickerCache.delete(k);
  }
  return hit.value;
}
