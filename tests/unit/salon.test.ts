import { describe, expect, it } from "vitest";
import { findArt } from "@/lib/art";
import { parseStyle, styleBill, styleButton, styleMessage, type SalonItem } from "@/lib/salon";
import { avatarLayers } from "@/lib/shop";

// 미용실 (SHOP-07, specs/052-salon)
const item = (id: number, slot: SalonItem["slot"], price: number, requiredLevel = 1, owned = false): SalonItem => ({ id, slot, name: `머리${id}`, art: "hair.bob", price, requiredLevel, owned });
const catalog = [item(1, "hair", 0), item(2, "hair", 120, 3), item(3, "hair_color", 30), item(4, "hair_color", 0, 1, true)];

describe("styleBill", () => {
  it("무료는 0코인으로 받는다", () => {
    const bill = styleBill({ hair: 1, hair_color: null }, { hair: null, hair_color: null }, catalog, 1, 0);
    expect(bill).toMatchObject({ kind: "ok", total: 0 });
    expect(styleButton(bill)).toBe("✨ 적용하기");
  });
  it("유료는 합계, 잠긴 레벨이 먼저", () => {
    expect(styleButton(styleBill({ hair: 1, hair_color: 3 }, { hair: null, hair_color: null }, catalog, 1, 100))).toBe("🪙 30 내고 적용하기");
    expect(styleBill({ hair: 2, hair_color: 3 }, { hair: null, hair_color: null }, catalog, 1, 0)).toEqual({ kind: "level", level: 3 });
    expect(styleBill({ hair: null, hair_color: 3 }, { hair: null, hair_color: null }, catalog, 1, 10)).toMatchObject({ kind: "coins", short: 20 });
  });
  it("같으면 same, 문구", () => {
    expect(styleBill({ hair: null, hair_color: 4 }, { hair: null, hair_color: 4 }, catalog, 1, 0)).toEqual({ kind: "same" });
    expect(styleMessage(["뽀글 파마"], 120)).toBe("🎉 뽀글 파마를 🪙 120에 샀어요. 새 머리가 잘 어울려요!");
    expect(styleMessage([], 0)).toBe("✨ 새 머리가 잘 어울려요!");
  });
  it("폼 값", () => {
    expect(parseStyle({ hair: "5", hair_color: "" })).toEqual({ hair: 5, hair_color: null });
    expect(parseStyle({ hair: "x" })).toBeNull();
  });
});

describe("머리 그림 순서", () => {
  it("사람: 원래 머리를 지우고 몸 → 옷 → 머리 → 소품 → 모자, 머리 색은 몸·머리에", () => {
    expect(avatarLayers("char.boy", { hair: "hair.bob", hair_color: "haircolor.pink", clothes: "clothes.suit", accessory: "acc.glasses", hat: "hat.crown" })).toEqual([
      "char.boy~bald~#f29ac0",
      "clothes.suit",
      "hair.bob~#f29ac0",
      "acc.glasses",
      "hat.crown",
    ]);
    expect(avatarLayers("char.girl", { hair_color: "haircolor.black" })).toEqual(["char.girl~#2b2522"]);
  });
  it("동물은 머리를 그리지 않는다", () => {
    expect(avatarLayers("animal.cat", { hair: "hair.bob", hair_color: "haircolor.pink", hat: "hat.straw" })).toEqual(["animal.cat", "hat.straw"]);
  });
  it("꼬리표 그림을 찾고, 머리 7가지·색 8가지가 16×16", () => {
    expect(findArt("char.boy~bald")!.rows.join("")).not.toContain("H");
    expect(findArt("hair.perm~#f29ac0")!.palette.H).toBe("#f29ac0");
    expect(findArt("char.boy~nope")).toBeUndefined();
    const keys = ["short", "bob", "spiky", "ponytail", "long", "bun", "perm"].map((k) => `hair.${k}`).concat(["brown", "black", "blond", "red", "pink", "mint", "purple", "silver"].map((k) => `haircolor.${k}`));
    for (const key of keys) {
      const art = findArt(key)!;
      expect(art, key).toBeDefined();
      expect(art.rows).toHaveLength(16);
      for (const row of art.rows) {
        expect(row, key).toHaveLength(16);
        for (const ch of row) if (ch !== ".") expect(art.palette[ch], `${key} ${ch}`).toBeDefined();
      }
    }
  });
});
