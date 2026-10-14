// 📰 뉴스 위젯: 네이버 검색 API(뉴스) 응답 읽기와 "많이 다룬 이슈" 고르기. 브라우저와 서버가 같이 쓴다.
// 기사 본문은 가져오지 않는다 — 제목·언론사·시각과 원문 링크만 (네이버 검색 API 이용 약관대로 출처 표시).

export const NEWS_TABS = [
  { key: "all", label: "종합", query: "속보" },
  { key: "economy", label: "경제", query: "경제" },
  { key: "it", label: "IT", query: "IT 기술" },
  { key: "society", label: "사회", query: "사회" },
  { key: "entertain", label: "연예", query: "연예" },
  { key: "sports", label: "스포츠", query: "스포츠" },
] as const;

export type NewsTab = (typeof NEWS_TABS)[number]["key"];
export type NewsItem = { title: string; url: string; source: string; at: string; count: number };
export type NewsResult = { tab: NewsTab; items: NewsItem[]; at: string };

export const NEWS_TOP = 5;

export function isNewsTab(value: unknown): value is NewsTab {
  return NEWS_TABS.some((t) => t.key === value);
}

const ENTITIES: Record<string, string> = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&apos;": "'", "&#39;": "'", "&middot;": "·", "&hellip;": "…", "&lsquo;": "‘", "&rsquo;": "’", "&ldquo;": "“", "&rdquo;": "”" };

/** 네이버가 굵게 표시한 <b>와 HTML 엔티티를 지운 제목 */
export function cleanTitle(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;|&#39;/g, (e) => ENTITIES[e] ?? e)
    .replace(/\s+/g, " ")
    .trim();
}

// 원문 주소의 도메인 → 언론사 이름 (모르면 도메인)
const SOURCES: [RegExp, string][] = [
  [/(^|\.)yna\.co\.kr$/, "연합뉴스"],
  [/(^|\.)yonhapnewstv\.co\.kr$/, "연합뉴스TV"],
  [/(^|\.)kbs\.co\.kr$/, "KBS"],
  [/(^|\.)imbc\.com$/, "MBC"],
  [/(^|\.)sbs\.co\.kr$/, "SBS"],
  [/(^|\.)jtbc\.co\.kr$/, "JTBC"],
  [/(^|\.)ytn\.co\.kr$/, "YTN"],
  [/(^|\.)mbn\.co\.kr$/, "MBN"],
  [/(^|\.)ichannela\.com$/, "채널A"],
  [/(^|\.)tvchosun\.com$/, "TV조선"],
  [/(^|\.)chosun\.com$/, "조선일보"],
  [/(^|\.)joongang\.co\.kr$/, "중앙일보"],
  [/(^|\.)donga\.com$/, "동아일보"],
  [/(^|\.)hani\.co\.kr$/, "한겨레"],
  [/(^|\.)khan\.co\.kr$/, "경향신문"],
  [/(^|\.)hankookilbo\.com$/, "한국일보"],
  [/(^|\.)seoul\.co\.kr$/, "서울신문"],
  [/(^|\.)kmib\.co\.kr$/, "국민일보"],
  [/(^|\.)segye\.com$/, "세계일보"],
  [/(^|\.)munhwa\.com$/, "문화일보"],
  [/(^|\.)hankyung\.com$/, "한국경제"],
  [/(^|\.)mk\.co\.kr$/, "매일경제"],
  [/(^|\.)sedaily\.com$/, "서울경제"],
  [/(^|\.)mt\.co\.kr$/, "머니투데이"],
  [/(^|\.)edaily\.co\.kr$/, "이데일리"],
  [/(^|\.)asiae\.co\.kr$/, "아시아경제"],
  [/(^|\.)heraldcorp\.com$/, "헤럴드경제"],
  [/(^|\.)fnnews\.com$/, "파이낸셜뉴스"],
  [/(^|\.)newsis\.com$/, "뉴시스"],
  [/(^|\.)news1\.kr$/, "뉴스1"],
  [/(^|\.)nocutnews\.co\.kr$/, "노컷뉴스"],
  [/(^|\.)ohmynews\.com$/, "오마이뉴스"],
  [/(^|\.)etnews\.com$/, "전자신문"],
  [/(^|\.)zdnet\.co\.kr$/, "지디넷코리아"],
  [/(^|\.)bloter\.net$/, "블로터"],
  [/(^|\.)dt\.co\.kr$/, "디지털타임스"],
  [/(^|\.)sportschosun\.com$/, "스포츠조선"],
  [/(^|\.)osen\.co\.kr$/, "OSEN"],
  [/(^|\.)xportsnews\.com$/, "엑스포츠뉴스"],
  [/(^|\.)naver\.com$/, "네이버 뉴스"],
];

export function sourceOf(url: string): string {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\.|^m\./, "");
  } catch {
    return "";
  }
  return SOURCES.find(([re]) => re.test(host))?.[1] ?? host;
}

// 제목에서 뜻 있는 낱말만 (두 글자 이상, 흔한 꾸밈말·조사 끝 정리)
const STOP = new Set(["속보", "단독", "종합", "포토", "영상", "사진", "오늘", "이번", "관련", "위해", "대한", "통해", "지난", "올해", "발표", "기자", "뉴스", "경제", "사회", "연예", "스포츠"]);
const JOSA = /(은|는|이|가|을|를|의|에|에서|에게|으로|로|과|와|도|만|까지|부터|이다|했다|한다|된다)$/;

export function titleWords(title: string): Set<string> {
  const words = title
    .replace(/\[[^\]]*\]|【[^】]*】|\([^)]*\)/g, " ")
    .split(/[^0-9A-Za-z가-힣]+/)
    .map((w) => (w.length > 2 ? w.replace(JOSA, "") : w))
    .filter((w) => w.length >= 2 && !STOP.has(w));
  return new Set(words);
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / Math.min(a.size, b.size);
}

type Raw = { title: string; originallink?: string; link?: string; pubDate?: string };

/**
 * 네이버 뉴스 검색 결과(최신순) → 여러 언론사가 같이 다룬 이야기 순 TOP N ("이슈").
 * 제목 낱말이 절반 넘게 겹치는 기사를 한 묶음으로 보고, 묶음이 큰 순(같으면 최근 순). 묶음마다 가장 최근 기사 하나.
 */
export function pickIssues(items: unknown, top = NEWS_TOP): NewsItem[] {
  if (!Array.isArray(items)) return [];
  const rows = (items as Raw[])
    .filter((r) => r && typeof r.title === "string")
    .map((r) => {
      const title = cleanTitle(r.title);
      const url = (r.originallink || r.link || "").trim();
      const at = r.pubDate ? new Date(r.pubDate) : new Date(NaN);
      return { title, url, at, words: titleWords(title) };
    })
    .filter((r) => r.title && /^https?:\/\//.test(r.url) && !Number.isNaN(r.at.getTime()));
  const groups: { lead: (typeof rows)[number]; members: (typeof rows)[number][]; sources: Set<string> }[] = [];
  for (const r of rows) {
    const g = groups.find((g) => overlap(g.lead.words, r.words) >= 0.5);
    if (g) {
      g.members.push(r);
      g.sources.add(sourceOf(r.url));
      if (r.at > g.lead.at) g.lead = r;
    } else groups.push({ lead: r, members: [r], sources: new Set([sourceOf(r.url)]) });
  }
  return groups
    .sort((a, b) => b.sources.size - a.sources.size || b.members.length - a.members.length || b.lead.at.getTime() - a.lead.at.getTime())
    .slice(0, top)
    .map((g) => ({ title: g.lead.title, url: g.lead.url, source: sourceOf(g.lead.url), at: g.lead.at.toISOString(), count: g.sources.size }));
}
