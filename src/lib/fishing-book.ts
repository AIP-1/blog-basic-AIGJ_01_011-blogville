import { CATCHES, type CatchCode } from "./fishing";

// 낚시 도감 (plaza-upgrade-2 C3): fishing_catches를 낚은 것별로 묶은 줄 → 여섯 칸. 마이그레이션 없이 기록에서 바로 만든다.

/** `select catch, count(*), min(date) … group by catch` 한 줄 */
export type CatchGroup = { catch: string; count: number; first: string };

export type DexCell = { code: CatchCode; name: string; coin: number | null; count: number; first: string | null };

/** 표(CATCHES) 순서의 여섯 칸. 모르는 낚은 것 줄은 버린다 */
export function catchBook(groups: readonly CatchGroup[]): DexCell[] {
  return CATCHES.map((c) => {
    const g = groups.find((r) => r.catch === c.code);
    return { code: c.code, name: c.name, coin: c.coin, count: g ? Number(g.count) : 0, first: g ? g.first : null };
  });
}

/** 머리 줄: `6종 중 4종` */
export function dexProgress(cells: readonly DexCell[]): string {
  return `${cells.length}종 중 ${cells.filter((c) => c.count > 0).length}종`;
}
