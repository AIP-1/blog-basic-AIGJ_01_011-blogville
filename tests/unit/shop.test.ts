import { describe, expect, it } from "vitest";
import { avatarLayers, buttonState, equipMessage, purchaseMessage, sectionOf, sortShopItems, type ShopItem } from "@/lib/shop";

const item = (id: number, over: Partial<ShopItem> = {}): ShopItem => ({
  id,
  type: "hat",
  name: `아이템${id}`,
  description: "",
  art: "hat.straw",
  price: 100,
  requiredLevel: 1,
  owned: false,
  owners: 0,
  ...over,
});

describe("버튼 상태 (SHOP-01·02·03)", () => {
  it("보유 → 레벨 부족 → 코인 부족 → 사기 순서", () => {
    expect(buttonState({ owned: true, requiredLevel: 9, price: 999 }, 1, 0)).toEqual({ kind: "owned" });
    expect(buttonState({ owned: false, requiredLevel: 3, price: 999 }, 2, 0)).toEqual({ kind: "level", level: 3 });
    expect(buttonState({ owned: false, requiredLevel: 3, price: 120 }, 3, 119)).toEqual({ kind: "coins" });
    expect(buttonState({ owned: false, requiredLevel: 3, price: 120 }, 3, 120)).toEqual({ kind: "buy" });
  });
});

describe("정렬 (SHOP-01)", () => {
  const list = [
    item(1, { requiredLevel: 2, price: 50, owners: 1 }),
    item(2, { requiredLevel: 1, price: 80, owners: 5, owned: true }),
    item(3, { requiredLevel: 1, price: 50, owners: 5 }),
    item(4, { requiredLevel: 3, price: 80, owners: 0 }),
  ];
  const ids = (sort: Parameters<typeof sortShopItems>[1]) => sortShopItems(list, sort).map((i) => i.id);
  it("레벨순(같으면 싼 순), 인기순(같으면 싼 순), 비싼 순·싼 순(같으면 레벨), 최신순, 보유순, 마지막은 ID", () => {
    expect(ids("level")).toEqual([3, 2, 1, 4]);
    expect(ids("popular")).toEqual([3, 2, 1, 4]);
    expect(ids("price_desc")).toEqual([2, 4, 3, 1]);
    expect(ids("price_asc")).toEqual([3, 1, 2, 4]);
    expect(ids("newest")).toEqual([4, 3, 2, 1]);
    expect(ids("owned")).toEqual([2, 1, 3, 4]);
  });
});

describe("구역·안내", () => {
  it("모자·옷·소품은 아바타, 캐릭터는 어디에도 없다", () => {
    expect(["hat", "clothes", "accessory", "furniture", "background", "character"].map(sectionOf)).toEqual(["avatar", "avatar", "avatar", "furniture", "background", null]);
  });
  it("받침에 맞는 조사와 종류별 안내", () => {
    expect(purchaseMessage("밀짚모자", "hat")).toBe("🎉 밀짚모자를 샀어요! 꾸미기에서 장착해 보세요.");
    expect(purchaseMessage("책장", "furniture")).toBe("🎉 책장을 샀어요! 내 블로그의 우리 집에 놓아 보세요.");
  });
});

describe("아바타 겹쳐 그리기 (SHOP-06)", () => {
  it("캐릭터 → 옷 → 소품 → 모자, 캐릭터가 없으면 아무것도 없다", () => {
    expect(avatarLayers("char.boy", { hat: "hat.straw", clothes: "clothes.dress", accessory: "acc.scarf" })).toEqual(["char.boy", "clothes.dress", "acc.scarf", "hat.straw"]);
    expect(avatarLayers("char.girl", { hat: "hat.ribbon" })).toEqual(["char.girl", "hat.ribbon"]);
    expect(avatarLayers(null, { hat: "hat.ribbon" })).toEqual([]);
  });
  it("장착·벗기 문구", () => {
    expect(equipMessage("밀짚모자")).toBe("밀짚모자 장착을 저장했어요 ✓");
    expect(equipMessage("리본", true)).toBe("리본을 벗었어요 ✓");
    expect(equipMessage("밀짚모자", true)).toBe("밀짚모자를 벗었어요 ✓");
  });
});
