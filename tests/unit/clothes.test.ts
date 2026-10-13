import { describe, expect, it } from "vitest";
import { findArt } from "@/lib/art";
import { billButton, EMPTY_OUTFIT, outfitBill, outfitMessage, parseOutfit, parsePay, type ClothesItem } from "@/lib/clothes";

// 옷가게 (SHOP-08, specs/051-clothes-shop)
const item = (id: number, slot: ClothesItem["slot"], price: number, requiredLevel = 1, owned = false): ClothesItem => ({
  id,
  slot,
  name: `아이템${id}`,
  art: "hat.chef",
  price,
  requiredLevel,
  owned,
});
const catalog = [item(1, "clothes", 90), item(2, "hat", 70, 2), item(3, "hat", 500, 6), item(4, "accessory", 70, 1, true), item(5, "clothes", 160, 2)];

describe("outfitBill", () => {
  it("지금 모습과 같으면 same", () => {
    expect(outfitBill({ ...EMPTY_OUTFIT, accessory: 4 }, { ...EMPTY_OUTFIT, accessory: 4 }, catalog, 1, 0)).toEqual({ kind: "same" });
  });
  it("안 가진 것만 더한다", () => {
    const bill = outfitBill({ clothes: 1, hat: 2, accessory: 4 }, EMPTY_OUTFIT, catalog, 3, 1000);
    expect(bill).toMatchObject({ kind: "ok", total: 160 });
    expect(billButton(bill)).toBe("🪙 160 내고 입기");
  });
  it("가진 것만 바꾸면 무료", () => {
    const bill = outfitBill({ ...EMPTY_OUTFIT, accessory: 4 }, EMPTY_OUTFIT, catalog, 1, 0);
    expect(bill).toMatchObject({ kind: "ok", total: 0 });
    expect(billButton(bill)).toBe("✨ 입기");
  });
  it("벗기만 해도 바뀐다", () => {
    expect(outfitBill(EMPTY_OUTFIT, { ...EMPTY_OUTFIT, accessory: 4 }, catalog, 1, 0)).toMatchObject({ kind: "ok", total: 0 });
  });
  it("잠긴 레벨이 코인 부족보다 먼저, 가장 높은 레벨", () => {
    const bill = outfitBill({ clothes: 5, hat: 3, accessory: null }, EMPTY_OUTFIT, catalog, 1, 0);
    expect(bill).toEqual({ kind: "level", level: 6 });
    expect(billButton(bill)).toBe("🔒 Lv.6부터 살 수 있어요");
  });
  it("코인이 모자라면 얼마나 모자란지", () => {
    const bill = outfitBill({ clothes: 1, hat: 2, accessory: null }, EMPTY_OUTFIT, catalog, 2, 100);
    expect(bill).toMatchObject({ kind: "coins", short: 60, total: 160 });
    expect(billButton(bill)).toBe("코인이 60개 부족해요");
  });
});

describe("parseOutfit · parsePay", () => {
  it("빈 값은 벗기, 양의 정수만", () => {
    expect(parseOutfit({ clothes: "12", hat: "", accessory: null })).toEqual({ clothes: 12, hat: null, accessory: null });
    expect(parseOutfit({ clothes: "0" })).toBeNull();
    expect(parseOutfit({ hat: "1.5" })).toBeNull();
    expect(parseOutfit({ hat: 3 })).toBeNull();
  });
  it("합계는 0 이상의 정수 글자", () => {
    expect(parsePay("0")).toBe(0);
    expect(parsePay("160")).toBe(160);
    expect(parsePay("-1")).toBeNull();
    expect(parsePay("01")).toBeNull();
    expect(parsePay(null)).toBeNull();
  });
});

describe("outfitMessage", () => {
  it("산 것이 있으면 이름과 합계", () => {
    expect(outfitMessage(["정장"], 160)).toBe("🎉 정장을 🪙 160에 샀어요. 새 옷이 잘 어울려요!");
    expect(outfitMessage(["정장", "금관"], 660)).toBe("🎉 정장 외 1개를 🪙 660에 샀어요. 새 옷이 잘 어울려요!");
    expect(outfitMessage([], 0)).toBe("✨ 새 옷이 잘 어울려요!");
  });
});

describe("옷가게 그림", () => {
  it("새 옷 6벌·모자 3개가 16×16 칸이고 팔레트에 없는 글자가 없다", () => {
    for (const key of ["hat.chef", "hat.wizard", "hat.crown", "clothes.pajama", "clothes.chef", "clothes.suit", "clothes.hanbok", "clothes.robe", "clothes.armor"]) {
      const art = findArt(key);
      expect(art, key).toBeDefined();
      expect(art!.rows).toHaveLength(16);
      for (const row of art!.rows) {
        expect(row, key).toHaveLength(16);
        for (const ch of row) if (ch !== ".") expect(art!.palette[ch], `${key} ${ch}`).toBeDefined();
      }
    }
  });
});
