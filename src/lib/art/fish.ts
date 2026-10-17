// 낚시 도감 도트 (plaza-upgrade-2 C3): 낚을 수 있는 여섯 가지. 외곽선은 모두 #3b2a20(마을 잉크).
// 모두 손으로 찍은 칸 그림이다 (왼쪽을 보는 물고기, 갈라진 꼬리, 배 쪽 밝은 줄).

import type { PixelArt } from "./characters";
import type { CatchCode } from "@/lib/fishing";

export const FISH_OUTLINE = "#3b2a20";

const MINNOW = [".OOOO.OO", "OBOBBOfO", "OBBBBBO.", "ObbbbOfO", ".OOOO.OO"];
const CRUCIAN = ["..OOOO....", ".OBBfBO.OO", "OBOBBBBOfO", "OBBBBBBBO.", ".ObbbbbOfO", "..OOOOO.OO"];
const CARP = ["...OOOOO....", "..OBBfBBO.OO", ".OBBBBfBBOfO", "OBOBBBBfBBO.", ".ObbbbbbbOfO", "..ObbbbbO.OO", "...OOOOO...."];
const GOLDEN = ["s..OOOOO....", "..OBBfBBO.OO", ".OBBsBBBBOfO", "OBOBBBBsBBO.", ".ObbbbbbbOfO", "..ObbbbbO.OO", "...OOOOO..s."];

/** 왼쪽을 보는 물고기 넷: 송사리 8×5, 붕어 10×6, 잉어·황금 잉어 12×7. B 몸, b 배, f 지느러미·비늘, s 반짝임 */
const FISH: Record<"minnow" | "crucian" | "carp" | "golden_carp", PixelArt> = {
  minnow: { rows: MINNOW, palette: { O: FISH_OUTLINE, B: "#a8b4bc", b: "#d6dde1", f: "#8796a0" } },
  crucian: { rows: CRUCIAN, palette: { O: FISH_OUTLINE, B: "#8a6a3a", b: "#b9975e", f: "#6c5029" } },
  carp: { rows: CARP, palette: { O: FISH_OUTLINE, B: "#c8542c", b: "#ec8f5e", f: "#9c3b1c" } },
  golden_carp: { rows: GOLDEN, palette: { O: FISH_OUTLINE, B: "#e9b341", b: "#f6d77a", f: "#c48a1e", s: "#fff3c4" } },
};

/** 동물 먹이 꾸러미 (10×8): 위를 끈으로 묶은 자루, 새싹 하나 */
function feedArt(): PixelArt {
  return {
    rows: [
      "....GG....",
      "..OO.GOO..",
      "..OBOOBO..",
      "...OYYO...",
      "..OBBBBO..",
      ".OBBbBBBO.",
      "OBBBBBBbBO",
      ".OOOOOOOO.",
    ],
    palette: { O: FISH_OUTLINE, B: "#b07a4a", b: "#d5a46c", Y: "#e9d27a", G: "#6db35c" },
  };
}

/** 낡은 장화 (9×9): 기운 자국과 물방울 */
function bootArt(): PixelArt {
  return {
    rows: [
      ".OOOOO...",
      ".OBBBO...",
      ".OBpBO..w",
      ".OBBBO...",
      ".OBBBO..w",
      ".OBBBOOO.",
      "OBBBBBBBO",
      "OBBBBpBBO",
      "OOOOOOOOO",
    ],
    palette: { O: FISH_OUTLINE, B: "#5a3d26", p: "#8a6a4a", w: "#8fd0f5" },
  };
}

/** 도감·결과 팝업의 도트 그림 */
export function catchArt(code: CatchCode): PixelArt {
  if (code === "feed") return feedArt();
  if (code === "boot") return bootArt();
  return FISH[code];
}

/** 아직 못 낚은 칸의 실루엣: 모든 칸을 잉크색 하나로 (투명도는 그리는 쪽에서 0.6) */
export function silhouetteArt(art: PixelArt): PixelArt {
  return { rows: art.rows, palette: Object.fromEntries(Object.keys(art.palette).map((k) => [k, FISH_OUTLINE])) };
}
