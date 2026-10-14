// 블로그 옆 칸 위젯보드 (블로그 꾸미기): 주인이 순서·보이기·크기를 고른다. 브라우저와 서버가 같이 쓴다.
// DB에는 blogs.widget_layout(jsonb)에 { items: [{ key, visible, size }] } 로 둔다. NULL이면 기본 배치.
// (날씨 위젯의 도시는 위젯 안에서 주인이 바로 바꾼다: blogs.weather_city)
// 모르는 키·겹친 키는 버리고, 새로 생긴 위젯은 기본값으로 맨 뒤에 붙인다 (옛 배치를 저장한 블로그도 새 위젯이 보이게).

export const WIDGETS = [
  { key: "guestbook", icon: "📖", label: "방명록", sizable: false, hint: "방명록 바로 가기와 글 수" },
  { key: "calendar", icon: "📅", label: "캘린더", sizable: false, hint: "글 쓴 날 표시, 누르면 그날 글" },
  { key: "weather", icon: "☀️", label: "이번 주 날씨", sizable: false, hint: "지금·시간대별·7일 예보, 미세먼지 (도시는 위젯에서 바꿔요)" },
  { key: "stocks", icon: "📈", label: "관심 종목", sizable: true, hint: "실시간 시세 · 작게: 이름과 등락률만" },
  { key: "search", icon: "🔍", label: "블로그 검색", sizable: false, hint: "이 블로그에서 글 찾기" },
  { key: "town", icon: "🏘", label: "마을 검색", sizable: false, hint: "주인에게만 보여요" },
  { key: "categories", icon: "🗂", label: "카테고리", sizable: false, hint: "카테고리 목록" },
  { key: "recent", icon: "📝", label: "최근 글", sizable: true, hint: "작게: 3개 / 크게: 5개와 사진" },
  { key: "popular", icon: "🔥", label: "인기 글", sizable: true, hint: "작게: 3개 / 크게: 5개" },
  { key: "comments", icon: "💬", label: "최근 댓글", sizable: true, hint: "작게: 3개 / 크게: 5개" },
  { key: "tags", icon: "🏷", label: "태그", sizable: true, hint: "작게: 10개 / 크게: 30개" },
  { key: "visits", icon: "👣", label: "방문자", sizable: true, hint: "작게: 숫자 / 크게: 최근 7일 그래프" },
  { key: "rss", icon: "📡", label: "RSS 구독", sizable: false, hint: "RSS 리더로 새 글 받기" },
] as const;

export type WidgetKey = (typeof WIDGETS)[number]["key"];
export type WidgetSize = "sm" | "lg";
export type WidgetItem = { key: WidgetKey; visible: boolean; size: WidgetSize };
export type WidgetLayout = { items: WidgetItem[] };

export function isWidgetKey(value: unknown): value is WidgetKey {
  return WIDGETS.some((w) => w.key === value);
}

export function widgetInfo(key: WidgetKey) {
  return WIDGETS.find((w) => w.key === key)!;
}

/** 처음 배치: 모두 보이고 크게 */
export function defaultLayout(): WidgetLayout {
  return { items: WIDGETS.map((w) => ({ key: w.key, visible: true, size: "lg" })) };
}

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : null);

/** DB·폼에서 온 값 → 올바른 배치 (모르는 값은 버리고 빠진 위젯은 기본값으로 뒤에) */
export function layoutOf(value: unknown): WidgetLayout {
  const base = defaultLayout();
  const r = rec(value);
  if (!r) return base;
  const seen = new Set<WidgetKey>();
  const items: WidgetItem[] = [];
  if (Array.isArray(r.items)) {
    for (const raw of r.items) {
      const it = rec(raw);
      if (!it || !isWidgetKey(it.key) || seen.has(it.key)) continue;
      seen.add(it.key);
      const sizable = widgetInfo(it.key).sizable;
      items.push({ key: it.key, visible: it.visible !== false, size: sizable && it.size === "sm" ? "sm" : "lg" });
    }
  }
  for (const it of base.items) if (!seen.has(it.key)) items.push(it);
  return { items };
}

/** 배치를 한 칸 위(-1)·아래(+1)로. 끝이면 그대로 */
export function moveWidget(items: WidgetItem[], key: WidgetKey, delta: -1 | 1): WidgetItem[] {
  const i = items.findIndex((it) => it.key === key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** 끌어 놓기: from 위젯을 to 위젯 자리로 */
export function dropWidget(items: WidgetItem[], from: WidgetKey, to: WidgetKey): WidgetItem[] {
  const i = items.findIndex((it) => it.key === from);
  const j = items.findIndex((it) => it.key === to);
  if (i < 0 || j < 0 || i === j) return items;
  const next = [...items];
  const [moved] = next.splice(i, 1);
  next.splice(j, 0, moved);
  return next;
}

/** 크기에 따른 목록 개수 */
export const WIDGET_LIMITS = { sm: { list: 3, tags: 10 }, lg: { list: 5, tags: 30 } } as const;

export const WIDGET_MESSAGES = {
  saved: "위젯 배치를 저장했어요",
  invalid: "위젯 배치를 읽을 수 없어요. 새로 고침한 뒤 다시 해 주세요.",
  reset: "기본 배치로 되돌렸어요",
} as const;
