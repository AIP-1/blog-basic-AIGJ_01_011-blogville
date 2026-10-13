import { ANIMAL_ART } from "./animals";
import { CHARACTER_ART, type PixelArt } from "./characters";
import { bald, HAIR_ART, hairColorSwatch, recolorHair } from "./hair";
import { ITEM_ART, MANNEQUIN_ART } from "./items";

/** 그림 키(`items.art`)로 도트 그림 찾기. 모르는 키면 undefined */
export function findArt(key: string | null | undefined): PixelArt | undefined {
  if (!key) return undefined;
  // 미용실 (SHOP-07): `그림~bald`(원래 머리 지우기)·`그림~#색`(머리 색) 꼬리표
  const [base, ...mods] = key.split("~");
  let art = baseArt(base);
  for (const mod of mods) {
    if (!art) return undefined;
    if (mod === "bald") art = bald(art);
    else if (/^#[0-9a-f]{6}$/i.test(mod)) art = recolorHair(art, mod);
    else return undefined;
  }
  return art;
}

function baseArt(key: string): PixelArt | undefined {
  if (key === "mannequin") return MANNEQUIN_ART;
  return CHARACTER_ART[key] ?? ITEM_ART[key] ?? ANIMAL_ART[key] ?? HAIR_ART[key] ?? hairColorSwatch(key);
}
