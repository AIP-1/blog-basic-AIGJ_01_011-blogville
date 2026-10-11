/** 글자 수 (코드 포인트). 이모지 하나 = 1자. */
export function codePointLength(value: string): number {
  return [...value].length;
}

/** 목록 카드용 요약: 공백을 한 칸으로 줄이고 max자까지 자른다. */
export function excerpt(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const chars = [...flat];
  return chars.length > max ? chars.slice(0, max).join("") + "…" : flat;
}

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `2026.10.11` (한국 시간) */
export function formatDate(date: Date): string {
  const parts = Object.fromEntries(dateFormat.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}.${parts.month}.${parts.day}`;
}
