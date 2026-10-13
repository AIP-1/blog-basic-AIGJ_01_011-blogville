// 미용실 (SHOP-07, specs/052-salon): 머리 모양은 캐릭터 머리 위에 겹치는 16×16 층, 머리 색은 `H` 색만 바꾼다.
// 머리 모양을 고르면 원래 머리(`H`)를 지운 캐릭터(`~bald`) 위에 그린다. 사람 캐릭터만.
import type { PixelArt } from "./characters";

const OUTLINE = "#3b2a20";
/** 그림을 그릴 때 쓰는 기본 머리 색 (머리 색을 고르지 않았을 때) */
const DEFAULT_HAIR = "#7a4a2a";

/** 머리 모양을 입힐 수 있는 캐릭터 */
export const HAIR_CHARACTERS: ReadonlySet<string> = new Set(["char.boy", "char.girl"]);

export const HAIR_COLORS: Readonly<Record<string, string>> = {
  "haircolor.brown": "#7a4a2a",
  "haircolor.black": "#2b2522",
  "haircolor.blond": "#f2cf6b",
  "haircolor.red": "#d9483b",
  "haircolor.pink": "#f29ac0",
  "haircolor.mint": "#6fd6c0",
  "haircolor.purple": "#8e5cc9",
  "haircolor.silver": "#c9ced6",
};

const E = "................";
const rows = (top: string[]) => [...top, ...Array.from({ length: 16 - top.length }, () => E)];

export const HAIR_ART: Readonly<Record<string, PixelArt>> = {
  "hair.short": { rows: rows([E, ".....KKKKKK.....", "....KHHHHHHK....", "...KHHHHHHHHK...", "...KHHHHHHHHK...", "...KH......HK..."]), palette: { K: OUTLINE, H: DEFAULT_HAIR } },
  "hair.bob": {
    rows: rows([E, ".....KKKKKK.....", "....KHHHHHHK....", "...KHHHHHHHHK...", "..KHHHHHHHHHHK..", "..KHH......HHK..", "..KHH......HHK..", "..KHH......HHK..", "..KKK......KKK.."]),
    palette: { K: OUTLINE, H: DEFAULT_HAIR },
  },
  "hair.spiky": {
    rows: rows(["..K..K..K..K....", "..KHKHKKHKHKK...", "...KHHHHHHHHK...", "...KHHHHHHHHK...", "...KHHHHHHHHK...", "...KH......HK..."]),
    palette: { K: OUTLINE, H: DEFAULT_HAIR },
  },
  "hair.ponytail": {
    rows: rows([E, ".....KKKKKK.....", "....KHHHHHHKKK..", "...KHHHHHHHHHHK.", "...KHHHHHHHHKHK.", "...KH......HKHK.", "............KHK.", "............KHK.", ".............K.."]),
    palette: { K: OUTLINE, H: DEFAULT_HAIR },
  },
  "hair.long": {
    rows: rows([E, ".....KKKKKK.....", "....KHHHHHHK....", "...KHHHHHHHHK...", "..KHHHHHHHHHHK..", "..KHH......HHK..", "..KHH......HHK..", "..KHH......HHK..", "..KHH......HHK..", "..KHH......HHK..", "..KHH......HHK..", "..KHH......HHK..", "..KKK......KKK.."]),
    palette: { K: OUTLINE, H: DEFAULT_HAIR },
  },
  "hair.bun": {
    rows: rows(["......KKKK......", ".....KHHHHK.....", "....KKHHHHKK....", "...KHHHHHHHHK...", "...KHHHHHHHHK...", "...KH......HK..."]),
    palette: { K: OUTLINE, H: DEFAULT_HAIR },
  },
  "hair.perm": {
    rows: rows(["....KK.KK.KK....", "...KHHKHHKHHK...", "..KHHHHHHHHHHK..", "..KHHHHHHHHHHK..", "..KHHHHHHHHHHK..", "..KHH......HHK..", "..KHH......HHK..", "...KK......KK..."]),
    palette: { K: OUTLINE, H: DEFAULT_HAIR },
  },
};

/** 머리 색 칸 그림 (작은 색 동그라미) */
export function hairColorSwatch(key: string): PixelArt | undefined {
  const color = HAIR_COLORS[key];
  if (!color) return undefined;
  return {
    rows: rows([E, E, E, E, ".....KKKKKK.....", "....KHHHHHHK....", "...KHHHHHHHHK...", "...KHHHHHHHHK...", "...KHHHHHHHHK...", "...KHHHHHHHHK...", "....KHHHHHHK....", ".....KKKKKK....."]),
    palette: { K: OUTLINE, H: color },
  };
}

/** 원래 머리(`H`)를 지운 캐릭터: 머리 꼭대기는 피부, 얼굴 옆으로 내려온 머리는 빈칸 */
export function bald(art: PixelArt): PixelArt {
  return { ...art, rows: art.rows.map((row, y) => (y < 5 ? row.replaceAll("H", "S") : row.replaceAll("H", "."))) };
}

/** 머리 색 바꾸기 */
export function recolorHair(art: PixelArt, color: string): PixelArt {
  return art.palette.H ? { ...art, palette: { ...art.palette, H: color } } : art;
}
