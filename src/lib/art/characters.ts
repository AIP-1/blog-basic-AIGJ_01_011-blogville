// 도트 캐릭터 (GAME-01). 2026-10-12 사용자 결정 "단순 도트": 16×16 칸을 글자로 적고 SVG 사각형으로 그린다.
// 글자 하나가 한 칸이고 `.`은 빈칸이다. 같은 줄에서 같은 색이 이어지면 사각형 하나로 합친다.

export type PixelArt = { rows: readonly string[]; palette: Readonly<Record<string, string>> };

const OUTLINE = "#3b2a20";
const SKIN = "#ffd7b0";
const EYE = "#2b2b2b";
const CHEEK = "#ff9aa2";

export const CHARACTER_ART: Readonly<Record<string, PixelArt>> = {
  // 남자 주민: 짧은 갈색 머리, 파란 셔츠, 남색 바지
  "char.boy": {
    rows: [
      "................",
      ".....KKKKKK.....",
      "....KHHHHHHK....",
      "...KHHHHHHHHK...",
      "...KHHHHHHHHK...",
      "...KHSSSSSSHK...",
      "...KSESSSSESK...",
      "...KSCSSSSCSK...",
      "....KSSSSSSK....",
      ".....KKSSKK.....",
      "....KBBBBBBK....",
      "...KSBBBBBBSK...",
      "...KSBBBBBBSK...",
      "....KPPPPPPK....",
      "....KPPKKPPK....",
      "....KKK..KKK....",
    ],
    palette: { K: OUTLINE, H: "#7a4a2a", S: SKIN, E: EYE, C: CHEEK, B: "#4a90d9", P: "#3d5a80" },
  },
  // 여자 주민: 긴 주황 머리, 분홍 원피스
  "char.girl": {
    rows: [
      "................",
      ".....KKKKKK.....",
      "....KHHHHHHK....",
      "...KHHHHHHHHK...",
      "..KHHHHHHHHHHK..",
      "..KHSSSSSSSSHK..",
      "..KHSESSSSESHK..",
      "..KHSCSSSSCSHK..",
      "..KHHSSSSSSHHK..",
      "..KHHKSSSSKHHK..",
      "...KKBBBBBBKK...",
      "...KSBBBBBBSK...",
      "...KSBBBBBBSK...",
      "...KBBBBBBBBK...",
      "....KKSKKSKK....",
      ".....KK..KK.....",
    ],
    palette: { K: OUTLINE, H: "#c0563a", S: SKIN, E: EYE, C: CHEEK, B: "#e86a92" },
  },
};

export type PixelRect = { x: number; y: number; width: number; fill: string };

/** 줄마다 같은 색이 이어진 칸을 사각형 하나로 (높이는 1) */
export function pixelRects(art: PixelArt): PixelRect[] {
  const rects: PixelRect[] = [];
  art.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      const fill = art.palette[ch];
      if (ch !== "." && fill) rects.push({ x, y, width: end - x, fill });
      x = end;
    }
  });
  return rects;
}
