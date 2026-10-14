// 🔎 글쓰기 키워드 도우미: 제목·태그 후보 단어들의 네이버 검색 관심도(데이터랩 검색어 트렌드)를 비교한다.
// 네이버는 "인기 검색어 순위"가 아니라 넣은 단어들의 기간별 상대값(가장 많이 찾은 때 = 100)만 준다.
// 브라우저와 서버가 같이 쓴다.

export const TREND_KEYWORD_MAX = 5;
export const TREND_KEYWORD_LEN = 20;

export const TREND_PERIODS = [
  { key: "m1", label: "1개월", days: 30, unit: "date" },
  { key: "m3", label: "3개월", days: 91, unit: "week" },
  { key: "y1", label: "1년", days: 365, unit: "week" },
] as const;

export type TrendPeriod = (typeof TREND_PERIODS)[number]["key"];
export type TrendSeries = { keyword: string; points: { period: string; ratio: number }[] };
export type TrendResult =
  | { status: "ok"; period: TrendPeriod; series: TrendSeries[] }
  | { status: "off" | "error" | "forbidden" | "invalid" };

/** 차트 선 색 (dataviz 기본 범주 팔레트 1~5번, 순서 고정) */
export const TREND_COLORS = [
  { light: "#2a78d6", dark: "#3987e5" },
  { light: "#eb6834", dark: "#d95926" },
  { light: "#1baf7a", dark: "#199e70" },
  { light: "#eda100", dark: "#c98500" },
  { light: "#e87ba4", dark: "#d55181" },
] as const;

export const TREND_MESSAGES = {
  invalid: `비교할 단어를 1~${TREND_KEYWORD_MAX}개 넣어 주세요 (한 단어 ${TREND_KEYWORD_LEN}자까지)`,
  off: "검색어 트렌드가 아직 켜져 있지 않아요",
  forbidden: "네이버 API HUB 앱에 '검색어 트렌드'가 추가되지 않았어요. 추가하면 바로 쓸 수 있어요",
  error: "네이버에서 검색 관심도를 받지 못했어요. 잠시 뒤 다시 해 주세요",
  empty: "이 기간에 네이버 검색 기록이 거의 없는 단어예요",
} as const;

export function isTrendPeriod(value: unknown): value is TrendPeriod {
  return TREND_PERIODS.some((p) => p.key === value);
}

/** 쉼표·줄바꿈으로 나눈 후보 → 앞뒤 공백·# 빼고, 겹친 것 빼고, 5개까지. 너무 긴 단어가 있으면 null */
export function parseKeywords(raw: string | string[]): string[] | null {
  const list = (Array.isArray(raw) ? raw : raw.split(/[,\n]/))
    .map((k) => k.replace(/^#+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of list) {
    if ([...k].length > TREND_KEYWORD_LEN) return null;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  if (out.length === 0) return null;
  return out.slice(0, TREND_KEYWORD_MAX);
}

/** 네이버 검색어 트렌드 요청 본문. endDate는 어제(오늘 자료는 아직 덜 모임), 한국 날짜 기준 */
export function trendRequest(keywords: string[], period: TrendPeriod, today: string) {
  const p = TREND_PERIODS.find((x) => x.key === period)!;
  const end = shiftDay(today, -1);
  return {
    startDate: shiftDay(end, -(p.days - 1)),
    endDate: end,
    timeUnit: p.unit,
    keywordGroups: keywords.map((k) => ({ groupName: k, keywords: [k] })),
  };
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** 응답 → 단어마다 점들. 단어 순서는 넣은 순서 그대로, 빠진 기간은 0으로 채운다 */
export function parseTrend(json: unknown, keywords: string[]): TrendSeries[] | null {
  const results = json && typeof json === "object" ? (json as { results?: unknown }).results : null;
  if (!Array.isArray(results)) return null;
  const byName = new Map<string, { period: string; ratio: number }[]>();
  const periods = new Set<string>();
  for (const r of results) {
    if (!r || typeof r !== "object") continue;
    const { title, data } = r as { title?: unknown; data?: unknown };
    if (typeof title !== "string" || !Array.isArray(data)) continue;
    const points: { period: string; ratio: number }[] = [];
    for (const d of data) {
      const { period, ratio } = (d ?? {}) as { period?: unknown; ratio?: unknown };
      if (typeof period !== "string" || typeof ratio !== "number" || !Number.isFinite(ratio)) continue;
      points.push({ period, ratio: Math.max(0, Math.min(100, ratio)) });
      periods.add(period);
    }
    byName.set(title, points);
  }
  const all = [...periods].sort();
  return keywords.map((keyword) => {
    const got = new Map((byName.get(keyword) ?? []).map((p) => [p.period, p.ratio]));
    return { keyword, points: all.map((period) => ({ period, ratio: got.get(period) ?? 0 })) };
  });
}

export type TrendSummary = { keyword: string; average: number; change: "up" | "down" | "flat"; changePct: number | null };

/** 단어마다 평균과 요즘 흐름(마지막 1/4 평균 vs 처음 1/4 평균, 20% 넘게 달라야 오름·내림) */
export function summarizeTrend(series: TrendSeries[]): TrendSummary[] {
  return series.map(({ keyword, points }) => {
    const values = points.map((p) => p.ratio);
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const q = Math.max(1, Math.floor(values.length / 4));
    const first = avg(values.slice(0, q));
    const last = avg(values.slice(-q));
    const changePct = first > 0 ? Math.round(((last - first) / first) * 100) : null;
    const change = changePct === null ? (last > 0 ? "up" : "flat") : changePct > 20 ? "up" : changePct < -20 ? "down" : "flat";
    return { keyword, average: Math.round(avg(values) * 10) / 10, change, changePct };
  });
}

/** 평균이 가장 높은 단어 (모두 0이면 null) */
export function bestKeyword(summary: TrendSummary[]): string | null {
  const top = [...summary].sort((a, b) => b.average - a.average)[0];
  return top && top.average > 0 ? top.keyword : null;
}
