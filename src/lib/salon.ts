// 미용실 (SHOP-07, specs/052-salon): 거울로 머리 모양·머리 색을 골라 보고, 안 가진 것만 한 번에 사서 바꾼다.
// 화면(계산서)과 서버(applyStyle)가 같은 계산을 쓴다. 무료 머리는 고르기만 해도 받는다.
import { formatNumber } from "./game";
import { withJosa } from "./josa";
import { STYLE_SLOTS, type StyleSlot } from "./shop";

/** 미용실에서만 다루는 아이템 종류 (상점 목록·상점 구매에서 뺀다) */
export const SALON_TYPES: readonly string[] = STYLE_SLOTS;

export const SALON_TABS: readonly { slot: StyleSlot; title: string; none: string }[] = [
  { slot: "hair", title: "💇 머리 모양", none: "원래 머리" },
  { slot: "hair_color", title: "🎨 머리 색", none: "원래 색" },
];

export type SalonItem = { id: number; slot: StyleSlot; name: string; art: string; price: number; requiredLevel: number; owned: boolean };
export type Style = Record<StyleSlot, number | null>;
export const EMPTY_STYLE: Style = { hair: null, hair_color: null };

export type StyleBill =
  | { kind: "same" }
  | { kind: "level"; level: number }
  | { kind: "coins"; short: number; buy: SalonItem[]; total: number }
  | { kind: "ok"; buy: SalonItem[]; total: number };

/** 계산서: 지금 모습과 다르면 고른 것 중 안 가진 것(무료 포함)을 받는다. 잠긴 레벨이 먼저 */
export function styleBill(style: Style, current: Style, catalog: readonly SalonItem[], level: number, coins: number): StyleBill {
  if (STYLE_SLOTS.every((slot) => style[slot] === current[slot])) return { kind: "same" };
  const buy = STYLE_SLOTS.flatMap((slot) => {
    const item = catalog.find((i) => i.id === style[slot]);
    return item && !item.owned ? [item] : [];
  });
  const locked = buy.filter((i) => i.requiredLevel > level).map((i) => i.requiredLevel);
  if (locked.length > 0) return { kind: "level", level: Math.max(...locked) };
  const total = buy.reduce((sum, i) => sum + i.price, 0);
  if (total > coins) return { kind: "coins", short: total - coins, buy, total };
  return { kind: "ok", buy, total };
}

export function styleButton(bill: StyleBill): string {
  switch (bill.kind) {
    case "same":
      return "지금 모습이에요";
    case "level":
      return `🔒 Lv.${bill.level}부터 살 수 있어요`;
    case "coins":
      return `코인이 ${formatNumber(bill.short)}개 부족해요`;
    case "ok":
      return bill.total > 0 ? `🪙 ${formatNumber(bill.total)} 내고 적용하기` : "✨ 적용하기";
  }
}

/** 바꾼 뒤 문구 (유료로 산 것만 이름을 적는다) */
export function styleMessage(paid: readonly string[], total: number): string {
  if (paid.length === 0 || total === 0) return "✨ 새 머리가 잘 어울려요!";
  const names = paid.length === 1 ? paid[0] : `${paid[0]} 외 ${paid.length - 1}개`;
  return `🎉 ${withJosa(names, "을/를")} 🪙 ${formatNumber(total)}에 샀어요. 새 머리가 잘 어울려요!`;
}

export const SALON_ERRORS = {
  invalid: "이 가게에서 고를 수 없는 아이템이에요",
  price: "가격이 바뀌었어요. 화면을 새로 고쳐 주세요",
  same: "지금 모습이에요",
  level: (level: number) => `Lv.${level}부터 살 수 있어요`,
  coins: (short: number) => `코인이 ${formatNumber(short)}개 부족해요`,
} as const;

export function parseStyle(raw: Partial<Record<StyleSlot, unknown>>): Style | null {
  const style: Style = { ...EMPTY_STYLE };
  for (const slot of STYLE_SLOTS) {
    const v = raw[slot];
    if (v === undefined || v === null || v === "") continue;
    if (typeof v !== "string" || !/^[1-9][0-9]{0,8}$/.test(v)) return null;
    style[slot] = Number(v);
  }
  return style;
}
