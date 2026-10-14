// 블로그 관심 종목 (📈 위젯) 규칙과 네이버 증권 응답 읽기. 브라우저와 서버가 같이 쓴다.

export type StockMarket = "KR" | "US";
export type StockItem = { market: StockMarket; code: string; name: string };

/** 위젯에 보여 줄 한 종목의 시세. 받지 못하면 price가 null */
export type StockQuote = StockItem & {
  price: number | null;
  change: number | null;
  rate: number | null;
  /** "KRW"·"USD" */
  currency: string;
  /** 장 상태 (OPEN·CLOSE 등), 모르면 null */
  status: string | null;
};

/** 증시 지수 (코스피·코스닥): 지금 값과 오늘 분 단위 흐름. 받지 못하면 price가 null */
export type StockIndex = {
  code: StockIndexCode;
  name: string;
  price: number | null;
  change: number | null;
  rate: number | null;
  status: string | null;
  /** 오늘 장중 값 (오래된 것부터, 많아야 80개). 장 시작 전이면 빈 목록 */
  chart: number[];
};

export const STOCK_INDEXES = [
  { code: "KOSPI", name: "코스피" },
  { code: "KOSDAQ", name: "코스닥" },
] as const;
export type StockIndexCode = (typeof STOCK_INDEXES)[number]["code"];

export function isStockIndex(value: unknown): value is StockIndexCode {
  return STOCK_INDEXES.some((i) => i.code === value);
}

/** 분 단위 지수 응답(api.stock.naver.com/chart/…/minute) → 값 목록 (많으면 고르게 솎아 max개) */
export function parseIndexChart(json: unknown, max = 80): number[] {
  if (!Array.isArray(json)) return [];
  const values = json.map((r) => toNumber((r as Record<string, unknown> | null)?.currentPrice)).filter((v): v is number => v !== null);
  if (values.length <= max) return values;
  const step = (values.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => values[Math.round(i * step)]);
}

export const STOCK_MAX = 10;
/** 스트림이 끊겼을 때 대신 묻는 간격 */
export const STOCK_REFRESH_MS = 5_000;
/** 서버가 실시간 스트림으로 새 시세를 확인하는 간격 */
export const STOCK_STREAM_MS = 1_500;
/** 스트림 한 번의 길이: 끝나면 브라우저가 바로 다시 붙는다 (오래된 연결이 쌓이지 않게) */
export const STOCK_STREAM_LIFETIME_MS = 5 * 60_000;
export const STOCK_ERRORS = {
  invalid: "이 종목은 넣을 수 없어요. 검색 결과에서 골라 주세요.",
  full: `관심 종목은 ${STOCK_MAX}개까지 넣을 수 있어요.`,
  duplicate: "이미 넣은 종목이에요.",
  added: "관심 종목에 넣었어요",
  removed: "관심 종목에서 뺐어요",
  reordered: "순서를 바꿨어요",
  stale: "종목 목록이 그새 바뀌었어요. 새로 고침한 뒤 다시 해 주세요.",
} as const;

const KR_CODE = /^[0-9A-Z]{6}$/;
const US_CODE = /^[A-Z0-9][A-Z0-9.\-]{0,15}$/;

/** 저장해도 되는 종목인지 (코드 모양·이름 길이). 이름은 앞뒤 공백을 지운 값 */
export function checkStock(market: string, code: string, name: string): StockItem | null {
  const n = name.trim();
  if (n.length < 1 || n.length > 60) return null;
  if (market === "KR" && KR_CODE.test(code)) return { market, code, name: n };
  if (market === "US" && US_CODE.test(code)) return { market, code, name: n };
  return null;
}

/** "71,000"·"-1.25"·71000 → 수. 읽을 수 없으면 null */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.replace(/,/g, "").trim();
  if (t === "" || t === "-" || t === "N/A") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * 네이버 증권 실시간 시세(polling.finance.naver.com/api/realtime/…)의 `datas` 한 줄.
 * 하락이면 compareToPreviousClosePrice·fluctuationsRatio가 이미 음수인 때와 양수인 때가 섞여 있어 compareToPreviousPrice.name으로 부호를 맞춘다.
 */
export function parseNaverQuote(row: unknown): { key: string; price: number | null; change: number | null; rate: number | null; currency: string | null; status: string | null; name: string | null } | null {
  const r = rec(row);
  if (!r) return null;
  const key = str(r.reutersCode) ?? str(r.itemCode) ?? str(r.symbolCode);
  if (!key) return null;
  const direction = str(rec(r.compareToPreviousPrice)?.name) ?? str(rec(r.compareToPreviousPrice)?.code);
  const falling = direction === "FALLING" || direction === "LOWER_LIMIT" || direction === "5" || direction === "4";
  const sign = (n: number | null) => (n === null ? null : falling ? -Math.abs(n) : direction === "EVEN" || direction === "3" ? 0 : Math.abs(n));
  const currency = str(rec(r.currencyType)?.code) ?? str(r.currencyType);
  return {
    key,
    price: toNumber(r.closePrice),
    change: sign(toNumber(r.compareToPreviousClosePrice)),
    rate: sign(toNumber(r.fluctuationsRatio)),
    currency,
    status: str(r.marketStatus),
    name: str(r.stockName),
  };
}

/** 네이버 증권 검색 자동 완성(ac.stock.naver.com/ac) 한 줄 → 넣을 수 있는 종목. 국내·미국 주식만 */
export function parseNaverSearchItem(row: unknown): StockItem | null {
  const r = rec(row);
  if (!r) return null;
  const nation = str(r.nationCode);
  const name = str(r.name);
  if (!name) return null;
  if (nation === "KOR") {
    const code = str(r.code);
    return code ? checkStock("KR", code, name) : null;
  }
  if (nation === "USA") {
    const code = str(r.reutersCode);
    return code ? checkStock("US", code, name) : null;
  }
  return null;
}

/** 위젯의 가격 글자: 원화는 정수에 쉼표, 달러는 소수 둘째 자리 */
export function formatPrice(price: number, currency: string): string {
  return currency === "KRW"
    ? Math.round(price).toLocaleString("ko-KR")
    : price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 등락 글자: ▲ 1,200 (+1.71%) · ▼ … · 보합 */
export function formatChange(change: number | null, rate: number | null, currency: string): string {
  if (change === null || rate === null) return "";
  if (change === 0) return `0 (0.00%)`;
  const arrow = change > 0 ? "▲" : "▼";
  return `${arrow} ${formatPrice(Math.abs(change), currency)} (${rate > 0 ? "+" : ""}${rate.toFixed(2)}%)`;
}
