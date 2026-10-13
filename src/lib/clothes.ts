// 옷가게 (SHOP-08, specs/051-clothes-shop): 거울로 미리 입어 보고, 안 가진 것만 한 번에 사서 입는다.
// 화면(계산서)과 서버(applyOutfit)가 같은 계산을 쓴다.
import { withJosa } from "./josa";
import { formatNumber } from "./game";
import { AVATAR_SLOTS, type AvatarSlot } from "./shop";

/** 옷가게 탭 순서: 옷 · 모자 · 소품 */
export const CLOTHES_TABS: readonly { slot: AvatarSlot; title: string; none: string }[] = [
  { slot: "clothes", title: "👕 옷", none: "안 입기" },
  { slot: "hat", title: "🎩 모자", none: "안 쓰기" },
  { slot: "accessory", title: "👓 소품", none: "안 하기" },
];

/** 옷가게에서만 파는 것 (상점 목록·상점 구매에서는 뺀다, 요구사항 4.6 "아바타 · 옷 (옷가게)") */
export const CLOTHES_SHOP_ONLY: readonly string[] = [
  "hat_chef",
  "hat_wizard",
  "hat_crown",
  "clothes_pajama",
  "clothes_chef",
  "clothes_suit",
  "clothes_hanbok",
  "clothes_robe",
  "clothes_armor",
];

export type ClothesItem = { id: number; slot: AvatarSlot; name: string; art: string; price: number; requiredLevel: number; owned: boolean };

/** 부위마다 고른 아이템 ID (없으면 벗음) */
export type Outfit = Record<AvatarSlot, number | null>;

export const EMPTY_OUTFIT: Outfit = { clothes: null, accessory: null, hat: null };

export type Bill =
  | { kind: "same" }
  | { kind: "level"; level: number }
  | { kind: "coins"; short: number; buy: ClothesItem[]; total: number }
  | { kind: "ok"; buy: ClothesItem[]; total: number };

/**
 * 계산서: 지금 입은 것(`current`)과 다르면, 고른 것 중 안 가진 것을 산다.
 * 잠긴 레벨이 먼저, 그다음 코인 부족.
 */
export function outfitBill(outfit: Outfit, current: Outfit, catalog: readonly ClothesItem[], level: number, coins: number): Bill {
  if (AVATAR_SLOTS.every((slot) => outfit[slot] === current[slot])) return { kind: "same" };
  const chosen = AVATAR_SLOTS.flatMap((slot) => {
    const item = catalog.find((i) => i.id === outfit[slot]);
    return item ? [item] : [];
  });
  const buy = chosen.filter((i) => !i.owned);
  const locked = buy.filter((i) => i.requiredLevel > level).map((i) => i.requiredLevel);
  if (locked.length > 0) return { kind: "level", level: Math.max(...locked) };
  const total = buy.reduce((sum, i) => sum + i.price, 0);
  if (total > coins) return { kind: "coins", short: total - coins, buy, total };
  return { kind: "ok", buy, total };
}

/** 계산서 버튼 문구 */
export function billButton(bill: Bill): string {
  switch (bill.kind) {
    case "same":
      return "지금 모습이에요";
    case "level":
      return `🔒 Lv.${bill.level}부터 살 수 있어요`;
    case "coins":
      return `코인이 ${formatNumber(bill.short)}개 부족해요`;
    case "ok":
      return bill.total > 0 ? `🪙 ${formatNumber(bill.total)} 내고 입기` : "✨ 입기";
  }
}

/** 다 입은 뒤 문구 */
export function outfitMessage(bought: readonly string[], total: number): string {
  if (bought.length === 0) return "✨ 새 옷이 잘 어울려요!";
  const names = bought.length === 1 ? bought[0] : `${bought[0]} 외 ${bought.length - 1}개`;
  return `🎉 ${withJosa(names, "을/를")} 🪙 ${formatNumber(total)}에 샀어요. 새 옷이 잘 어울려요!`;
}

export const CLOTHES_ERRORS = {
  invalid: "이 가게에서 고를 수 없는 아이템이에요",
  price: "가격이 바뀌었어요. 화면을 새로 고쳐 주세요",
  same: "지금 모습이에요",
  level: (level: number) => `Lv.${level}부터 살 수 있어요`,
  coins: (short: number) => `코인이 ${formatNumber(short)}개 부족해요`,
} as const;

/** 폼에서 온 값: 부위마다 빈 값(벗기) 또는 양의 정수 ID. 모양이 틀리면 null */
export function parseOutfit(raw: Partial<Record<AvatarSlot, unknown>>): Outfit | null {
  const outfit: Outfit = { ...EMPTY_OUTFIT };
  for (const slot of AVATAR_SLOTS) {
    const v = raw[slot];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" || !/^[1-9][0-9]{0,8}$/.test(v)) return null;
    outfit[slot] = Number(v);
  }
  return outfit;
}

/** 화면이 보낸 합계: 0 이상의 정수 */
export function parsePay(raw: unknown): number | null {
  return typeof raw === "string" && /^(0|[1-9][0-9]{0,8})$/.test(raw) ? Number(raw) : null;
}
