// 마을 구역 (광장 개편): HUD 장소 간판에 "지금 어디"를 보이고, 게임 화면에서 광장으로 돌아올 때(`/town?from=`) 설 자리를 정한다.

import { CENTER, EAST_ROAD, HILL_ROAD, inGarden, PLAZA_RADIUS, POND_POS, WEST_ROAD, type Point } from "./layout";

export const ZONES = ["plaza", "garden", "pond", "market", "hill", "west", "east", "south", "road"] as const;
export type Zone = (typeof ZONES)[number];

export const ZONE_LABELS: Record<Zone, string> = {
  plaza: "중앙 광장",
  garden: "정원",
  pond: "연못가",
  market: "가게 거리",
  hill: "언덕 길",
  west: "서쪽 마을",
  east: "동쪽 마을",
  south: "남쪽 마을",
  road: "마을 길",
};

/** 발밑 좌표가 든 구역. 정원 → 광장 → 연못 → 가게 거리(광장 북쪽) → 언덕 → 동서남 → 길 순으로 본다 */
export function zoneAt(p: Point): Zone {
  if (inGarden(p, 10)) return "garden";
  if (Math.hypot(p.x - CENTER.x, p.y - CENTER.y) <= PLAZA_RADIUS + 40) return "plaza";
  if (Math.hypot(p.x - POND_POS.x, p.y - POND_POS.y) <= 190) return "pond";
  if (p.y >= 430 && p.y < CENTER.y - PLAZA_RADIUS + 60 && p.x > CENTER.x - 330 && p.x < CENTER.x + 470) return "market";
  if (p.y < HILL_ROAD + 90) return "hill";
  if (p.x < WEST_ROAD - 40) return "west";
  if (p.x > EAST_ROAD + 40) return "east";
  if (p.y > 1420) return "south";
  return "road";
}

/**
 * 게임 화면에서 [광장으로] 나갈 때 돌아올 자리 (`/town?from={id}`). 텔레포트 목록(`townSpots`)의 장소 id와 같다.
 * 출석·마을 소식은 게시판, 낚시터는 연못.
 */
export const RETURN_SPOTS = ["board", "shop", "clothes", "salon", "farm", "pond", "home", "prompt"] as const;
export type ReturnSpot = (typeof RETURN_SPOTS)[number];

/**
 * `host`(친구 마을 블로그 주소)가 있으면 그 마을(`/town/{host}`)로 돌아간다. 없으면 중앙 광장.
 * `home`·`prompt`는 아직 장소 좌표가 없어 광장 시작 자리(분수 아래)에 선다 (plaza-upgrade-2).
 */
export function townReturnHref(spot: ReturnSpot | null, host?: string): string {
  const base = host ? `/town/${encodeURIComponent(host)}` : "/town";
  return spot ? `${base}?from=${spot}` : base;
}

/** 친구 마을 주소(`?host=`) 모양만 (블로그 주소 규칙 `^[a-z0-9_]{3,20}$`). 아니면 null */
export function parseHostSlug(value: unknown): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" && /^[a-z0-9_]{3,20}$/.test(v) ? v : null;
}

export function parseReturnSpot(value: unknown): ReturnSpot | null {
  return typeof value === "string" && (RETURN_SPOTS as readonly string[]).includes(value) ? (value as ReturnSpot) : null;
}
