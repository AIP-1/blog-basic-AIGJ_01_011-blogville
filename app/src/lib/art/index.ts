import { ANIMAL_ART } from "./animals";
import { CHARACTER_ART, type PixelArt } from "./characters";
import { ITEM_ART, MANNEQUIN_ART } from "./items";

/** 그림 키(`items.art`)로 도트 그림 찾기. 모르는 키면 undefined */
export function findArt(key: string | null | undefined): PixelArt | undefined {
  if (!key) return undefined;
  if (key === "mannequin") return MANNEQUIN_ART;
  return CHARACTER_ART[key] ?? ITEM_ART[key] ?? ANIMAL_ART[key];
}
