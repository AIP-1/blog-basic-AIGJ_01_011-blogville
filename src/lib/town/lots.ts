// 이웃 집 자리 고르기 (TOWN-18, specs/049-town-lots): 화면과 서버가 같이 쓴다.

/** 이웃 집 자리 번호 (0번은 주인의 집) */
export const NEIGHBOR_LOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** 자리가 있는 곳 */
export function lotArea(lot: number): string {
  if (lot >= 1 && lot <= 4) return "서쪽 길";
  if (lot >= 5 && lot <= 8) return "동쪽 길";
  return "남쪽 들판";
}

export function isNeighborLot(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= NEIGHBOR_LOTS.length;
}

/**
 * 즐겨찾는 이웃(즐겨찾기한 순서)에게 자리를 준다: 고른 자리(`townLot`)가 먼저, 안 고른 이웃은 남은 자리를
 * 작은 번호부터 차례로. 자리는 10개까지라 넘치는 이웃은 빠진다.
 */
export function assignLots<T extends { townLot: number | null }>(favorites: readonly T[]): (T & { lot: number })[] {
  const taken = new Set<number>();
  const placed = new Map<T, number>();
  for (const f of favorites) {
    if (f.townLot !== null && isNeighborLot(f.townLot) && !taken.has(f.townLot)) {
      taken.add(f.townLot);
      placed.set(f, f.townLot);
    }
  }
  const free = NEIGHBOR_LOTS.filter((l) => !taken.has(l));
  for (const f of favorites) {
    if (placed.has(f)) continue;
    const lot = free.shift();
    if (lot === undefined) break;
    placed.set(f, lot);
  }
  return favorites.filter((f) => placed.has(f)).map((f) => ({ ...f, lot: placed.get(f)! }));
}

/**
 * `id` 이웃을 `lot`번 자리로 옮긴 뒤 모두의 자리 (TOWN-18): 그 자리에 살던 이웃은 옮긴 이웃의 옛 자리로, 나머지는 그대로.
 */
export function moveToLot(placed: readonly { id: string; lot: number }[], id: string, lot: number): { id: string; lot: number | null }[] {
  const old = placed.find((p) => p.id === id)?.lot ?? null;
  return placed.map((p) => ({ id: p.id, lot: p.id === id ? lot : p.lot === lot ? old : p.lot }));
}

export const LOT_ERRORS = {
  lot: "이웃 집 자리는 1~10번이에요.",
  notFavorite: "⭐ 즐겨찾기한 이웃만 집 자리를 고를 수 있어요.",
} as const;

/** 추천 이웃(이사 올 이웃, plaza-upgrade-2)은 빈 자리 이만큼까지 */
export const SUGGESTED_HOUSES = 3;
/** 이 자리는 추천 이웃으로 채우지 않는다 (서쪽 길 끝 빈 집터: 처음 온 회원이 빈 집터 고르기를 만나는 자리) */
export const KEEP_EMPTY_LOT = 4;

/**
 * 추천 이웃을 세울 자리: 빈 자리 중 뒤쪽 번호부터 `n`개, 4번은 늘 비워 둔다.
 * 안 고른 이웃은 앞 번호부터 채우므로 뒤에서 채워야 이웃이 늘 때 추천 집과 덜 부딪힌다.
 */
export function suggestionLots(taken: Iterable<number>, n = SUGGESTED_HOUSES): number[] {
  const used = new Set(taken);
  return [...NEIGHBOR_LOTS]
    .reverse()
    .filter((lot) => lot !== KEEP_EMPTY_LOT && !used.has(lot))
    .slice(0, Math.max(0, n));
}

/**
 * 후보 묶음(앞 묶음이 먼저: 나를 ⭐한 회원 → 내가 이웃만 맺은 회원 → 활동 블로그)을 차례로 이어 `n`명을 고른다.
 * 묶음 안 순서는 `pick`(하루 씨앗 `dailyPick`)이 정해 하루 동안 같은 후보가 선다. `key`가 같은 후보와 `skip`에 든 후보는 뺀다.
 */
export function pickSuggestions<T>(tiers: readonly (readonly T[])[], key: (item: T) => string, skip: ReadonlySet<string>, n: number, pick: (items: readonly T[]) => T[]): T[] {
  const seen = new Set(skip);
  const out: T[] = [];
  for (const tier of tiers) {
    for (const item of pick(tier.filter((t) => !seen.has(key(t))))) {
      if (out.length >= n) return out;
      const k = key(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
    }
  }
  return out;
}

export const INVITE_ERRORS = {
  taken: "그 자리에는 벌써 이웃이 살아요. 다른 빈 집터를 골라 주세요.",
  already: "이미 ⭐ 즐겨찾는 이웃이에요.",
  self: "내 블로그는 이웃으로 모실 수 없어요.",
} as const;
