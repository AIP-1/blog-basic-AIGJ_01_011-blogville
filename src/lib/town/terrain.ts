// 마을 높낮이 (TOWN-05, specs/042-terrain): 3/4 탑다운. 높은 단의 남쪽 가장자리 아래로 돌벽 앞면이 보이고,
// 앞면은 걸을 수 없으며 길이 지나는 곳만 계단이다. 게임 화면·바닥 굽기·단위 시험이 같이 쓴다.
import { EAST_ROAD, ROAD, WEST_ROAD, WORLD, type Point, type Rect } from "./layout";

/** 돌벽 앞면 높이 (도트 12칸 × 4px) */
export const CLIFF_FACE = 48;
/** 높은 단의 남쪽 가장자리 y: 북쪽 언덕(높이 2) → 가운데(1), 가운데 → 남쪽 들판(0) */
export const CLIFF_LINES = [260, 1330] as const;
/** 맨 위 먼 하늘·산 (걸을 수 없다) */
export const SKY_HEIGHT = 90;
/** 계단은 길 가운데선에서 반폭 + 이만큼, 맨 바깥 `RAIL`은 돌 난간 */
export const STAIR_PAD = 15;
export const RAIL = 6;
/** 계단에서는 조금 느리게 */
export const STAIR_SLOW = 0.75;

export type Stair = { id: string; x: number; top: number; rect: Rect };

/** 계단: 서쪽·동쪽 길이 두 절벽을 지나는 4곳 */
export const STAIRS: readonly Stair[] = CLIFF_LINES.flatMap((line, i) =>
  [
    ["west", WEST_ROAD],
    ["east", EAST_ROAD],
  ].map(([side, x]) => ({
    id: `${i === 0 ? "north" : "south"}-${side}`,
    x: Number(x),
    top: line,
    rect: { x: Number(x) - ROAD / 2 - STAIR_PAD, y: line, width: ROAD + STAIR_PAD * 2, height: CLIFF_FACE },
  })),
);

/** 땅 높이: 북쪽 언덕 2, 가운데 1, 남쪽 들판 0 (앞면은 아래 단으로 친다) */
export function heightAt(y: number): number {
  return y < CLIFF_LINES[0] ? 2 : y < CLIFF_LINES[1] ? 1 : 0;
}

/** 걸을 수 없는 땅: 하늘, 절벽 앞면(계단 자리를 뺀 조각), 계단 양쪽 난간 */
export const TERRAIN_WALLS: readonly Rect[] = [
  { x: 0, y: 0, width: WORLD.width, height: SKY_HEIGHT },
  ...CLIFF_LINES.flatMap((line) => {
    const stairs = STAIRS.filter((s) => s.top === line)
      .map((s) => s.rect)
      .sort((a, b) => a.x - b.x);
    const walls: Rect[] = [];
    let x = 0;
    for (const r of stairs) {
      walls.push({ x, y: line, width: r.x + RAIL - x, height: CLIFF_FACE });
      x = r.x + r.width - RAIL;
    }
    walls.push({ x, y: line, width: WORLD.width - x, height: CLIFF_FACE });
    return walls;
  }),
];

/** 발밑이 계단 위인가 */
export function onStairs(p: Point): boolean {
  return STAIRS.some((s) => p.x >= s.rect.x && p.x <= s.rect.x + s.rect.width && p.y >= s.rect.y && p.y <= s.rect.y + s.rect.height + 16);
}

/** 계단 위·아래 끝 (시험 훅 `data-stairs`): 위 단 가장자리 바로 위, 아래 단 앞면 바로 아래 */
export function stairEnds(s: Stair): { top: Point; bottom: Point } {
  return { top: { x: s.x, y: s.top - 6 }, bottom: { x: s.x, y: s.top + CLIFF_FACE + 24 } };
}
