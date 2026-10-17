// 마을 하늘 (광장 개편): 한국 시간으로 새벽·낮·노을·밤을 정하고, 가로등과 글 쓴 집 창문 불빛도 이 시각을 따른다.
// 게임 화면(TownGame)·랜딩 마을 그림·휴대폰 광장이 같은 규칙을 쓴다. 시험과 미리보기는 `?sky=night`처럼 고정한다.

export const SKIES = ["dawn", "day", "dusk", "night"] as const;
export type Sky = (typeof SKIES)[number];

export const SKY_LABELS: Record<Sky, string> = {
  dawn: "새벽",
  day: "낮",
  dusk: "노을",
  night: "밤",
};

const hourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** 한국 시각을 시 단위 소수로 (14:30 → 14.5) */
export function kstHour(now = new Date()): number {
  const [h, m] = hourFormat.format(now).split(":").map(Number);
  return h + m / 60;
}

/** 새벽 05~07시, 낮 07~17시, 노을 17~19시, 밤 19~05시 (앞 시각 포함, 뒤 시각 빼고) */
export function skyAt(now = new Date()): Sky {
  const h = kstHour(now);
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 19) return "dusk";
  return "night";
}

/** 가로등은 낮이 아니면 켠다 (노을·밤·새벽) */
export function lampsOn(sky: Sky): boolean {
  return sky !== "day";
}

/**
 * 세계 위에 덧칠할 색 (캔버스 `multiply`). 낮은 덧칠하지 않는다(null, 프레임마다 한 번 아끼기).
 * 밤에도 길과 집이 읽히게 남색을 너무 진하게 두지 않는다.
 */
export const SKY_TINT: Record<Sky, { color: string; alpha: number } | null> = {
  dawn: { color: "#c9b8e8", alpha: 0.35 },
  day: null,
  dusk: { color: "#f2a65a", alpha: 0.32 },
  night: { color: "#3a3f78", alpha: 0.55 },
};

/** 주소 값(`?sky=night`)을 하늘로. 모르는 값이면 null (지금 시각을 쓴다) */
export function parseSky(value: unknown): Sky | null {
  return typeof value === "string" && (SKIES as readonly string[]).includes(value) ? (value as Sky) : null;
}

/** 다음 하늘이 바뀌는 때까지 남은 밀리초 (게임이 분마다 다시 보지 않아도 되게) */
export function msUntilNextSky(now = new Date()): number {
  const h = kstHour(now);
  const next = [5, 7, 17, 19, 29].find((b) => b > h) ?? 29;
  const ms = Math.round((next - h) * 3_600_000) - now.getSeconds() * 1000 - now.getMilliseconds();
  return Math.max(1000, ms);
}
