// 마을 계절 (plaza-upgrade-2): 한국 시각의 달로 정한다. 3~5월 봄, 6~8월 여름, 9~11월 가을, 12~2월 겨울.

export type Season = "spring" | "summer" | "autumn" | "winter";

const SEASONS: readonly Season[] = ["spring", "summer", "autumn", "winter"];

const KST_OFFSET_MS = 9 * 3_600_000;

/** `now`의 한국 시각 달로 계절을 고른다 */
export function seasonAt(now: Date): Season {
  const month = new Date(now.getTime() + KST_OFFSET_MS).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/** 주소 값(`?season=`)을 계절로. 모르는 값이면 null */
export function parseSeason(v: unknown): Season | null {
  return typeof v === "string" && (SEASONS as readonly string[]).includes(v) ? (v as Season) : null;
}
