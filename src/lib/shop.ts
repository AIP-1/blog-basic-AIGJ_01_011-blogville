import { formatNumber } from "./game";
import { withJosa } from "./josa";

// 마을 상점 (SHOP-01·02·03, specs/035-shop). 서버와 화면이 같이 쓴다.

export type ItemType = "character" | "hat" | "clothes" | "accessory" | "furniture" | "background" | "growth";
export type ShopSection = "avatar" | "furniture" | "background" | "growth";

/** 아바타 꾸미기 종류 (SHOP-06): 마네킹에 입혀 그린다 */
export const AVATAR_TYPES: readonly ItemType[] = ["hat", "clothes", "accessory"];

export function isAvatarType(type: string): boolean {
  return (AVATAR_TYPES as readonly string[]).includes(type);
}

export function sectionOf(type: string): ShopSection | null {
  if (isAvatarType(type)) return "avatar";
  if (type === "furniture" || type === "background" || type === "growth") return type;
  return null;
}

/** 구역 순서와 제목·안내 */
export const SHOP_SECTIONS: readonly { key: ShopSection; title: string; hint?: string }[] = [
  { key: "avatar", title: "👕 아바타 꾸미기" },
  { key: "furniture", title: "🪑 가구", hint: "산 가구는 내 블로그의 ‘우리 집’에 놓을 수 있어요." },
  { key: "background", title: "🖼 배경" },
  { key: "growth", title: "🌱 성장 아이템", hint: "동물 농장의 친구들을 빨리 키워 주는 먹이예요. 여러 번 살 수 있어요." },
];

/** 가입할 때 받아 거는 기본 배경 (SHOP-04) */
export const STARTER_BACKGROUND = "bg_meadow";

export const SHOP_EMPTY = "지금은 파는 아이템이 없어요.";

export const SHOP_ERRORS = {
  invalid: "살 수 없는 아이템이에요",
  owned: "이미 가지고 있는 아이템이에요",
  level: (level: number) => `레벨 ${level}부터 살 수 있어요`,
  coins: (short: number) => `코인이 ${formatNumber(short)}개 부족해요`,
} as const;

export type ShopItem = {
  id: number;
  type: ItemType;
  name: string;
  description: string;
  art: string;
  price: number;
  requiredLevel: number;
  owned: boolean;
  /** 가진 개수 (성장 아이템만 2개 이상) */
  quantity: number;
  /** 가진 회원 수 (인기순) */
  owners: number;
};

export type ButtonState = { kind: "owned" } | { kind: "level"; level: number } | { kind: "coins" } | { kind: "buy" };

/** 여러 개 살 수 있는 종류 (성장 아이템) */
export function isStackable(type: string): boolean {
  return type === "growth";
}

/** 버튼 상태: 보유(성장 아이템 제외) → 레벨 부족 → 코인 부족 → 사기 순서로 먼저 맞는 것 */
export function buttonState(item: Pick<ShopItem, "type" | "owned" | "requiredLevel" | "price">, level: number, coins: number): ButtonState {
  if (item.owned && !isStackable(item.type)) return { kind: "owned" };
  if (level < item.requiredLevel) return { kind: "level", level: item.requiredLevel };
  if (coins < item.price) return { kind: "coins" };
  return { kind: "buy" };
}

export const SHOP_SORTS = [
  { key: "level", label: "레벨순" },
  { key: "popular", label: "인기순" },
  { key: "price_desc", label: "비싼 순" },
  { key: "price_asc", label: "싼 순" },
  { key: "newest", label: "최신순" },
  { key: "owned", label: "보유순" },
] as const;

export type ShopSort = (typeof SHOP_SORTS)[number]["key"];

export function isShopSort(value: string): value is ShopSort {
  return SHOP_SORTS.some((s) => s.key === value);
}

type Cmp = (a: ShopItem, b: ShopItem) => number;
const by =
  (...cmps: Cmp[]): Cmp =>
  (a, b) => {
    for (const c of cmps) {
      const d = c(a, b);
      if (d !== 0) return d;
    }
    return a.id - b.id;
  };
const levelAsc: Cmp = (a, b) => a.requiredLevel - b.requiredLevel;
const priceAsc: Cmp = (a, b) => a.price - b.price;

const COMPARE: Record<ShopSort, Cmp> = {
  level: by(levelAsc, priceAsc),
  popular: by((a, b) => b.owners - a.owners, priceAsc),
  price_desc: by((a, b) => b.price - a.price, levelAsc),
  price_asc: by(priceAsc, levelAsc),
  newest: (a, b) => b.id - a.id,
  owned: by((a, b) => Number(b.owned) - Number(a.owned), priceAsc),
};

/** 정렬 (모든 정렬은 마지막에 ID 작은 순, 최신순은 ID 큰 순) */
export function sortShopItems(list: readonly ShopItem[], sort: ShopSort): ShopItem[] {
  return [...list].sort(COMPARE[sort]);
}

/** 산 뒤 안내 (`{이름}을/를`은 받침에 맞춘다) */
export function purchaseMessage(name: string, type: string): string {
  const bought = `🎉 ${withJosa(name, "을/를")} 샀어요!`;
  if (type === "furniture") return `${bought} 내 블로그의 우리 집에 놓아 보세요.`;
  if (type === "growth") return `${bought} 동물 농장에서 써 보세요.`;
  return `${bought} 꾸미기에서 장착해 보세요.`;
}

/** 겹쳐 그리는 순서: 캐릭터 → 옷 → 소품 → 모자 (SHOP-06) */
export const AVATAR_SLOTS = ["clothes", "accessory", "hat"] as const;
export type AvatarSlot = (typeof AVATAR_SLOTS)[number];

export function isAvatarSlot(value: unknown): value is AvatarSlot {
  return typeof value === "string" && (AVATAR_SLOTS as readonly string[]).includes(value);
}

/** 캐릭터 그림과 입은 아이템 그림을 그릴 순서대로 */
export function avatarLayers(character: string | null | undefined, equips: Partial<Record<AvatarSlot, string>>): string[] {
  if (!character) return [];
  return [character, ...AVATAR_SLOTS.flatMap((slot) => (equips[slot] ? [equips[slot]] : []))];
}

export const CLOSET_ERRORS = {
  notOwned: "가지고 있지 않은 아이템이에요",
  wrongType: "아직 장착할 수 없는 종류예요",
  failed: "장착하지 못했어요. 잠시 뒤 다시 시도해 주세요",
} as const;

/** 장착·벗기 확인 문구 (2초 뒤 사라짐) */
export function equipMessage(name: string, removed = false): string {
  return removed ? `${withJosa(name, "을/를")} 벗었어요 ✓` : `${name} 장착을 저장했어요 ✓`;
}
