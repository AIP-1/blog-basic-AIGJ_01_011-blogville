// 광장 개편 1단계 (살아 있는 마을): 게시판 쪽지·도장, 분수·연못 움직임, 불 켜진 집, 가로등, 하늘 나무, 캔버스 글씨
import { describe, expect, it } from "vitest";
import type { PixelArt } from "@/lib/art/characters";
import {
  BOARD_MAX,
  boardArt,
  cellGroups,
  chimneyTop,
  FOUNTAIN_FRAMES,
  fountainArt,
  glowCells,
  houseArt,
  lampArt,
  LIT_GLASS,
  litHouseArt,
  mailboxArt,
  POND_FRAMES,
  pondArt,
  SMOKE_FRAMES,
  smokeArt,
} from "@/lib/art/town";
import { BUBBLE_CHARS, bubbleText, TAG_BOX, tagFont, tagHeight } from "@/components/town/canvas-text";
import { ROOF_HEX } from "@/lib/roof";
import { TREE_MIN_Y, townLayout, type TownHouseInput } from "@/lib/town/structures";

// 개편 전(5eab7e1) boardArt()가 그린 그림 그대로
const LEGACY_BOARD_ROWS = [
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
  "RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR",
  ".FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.",
  ".FFKKKKKKKKKKKKKKKKKKKKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKKKKKKKKKKKKKKKKKKKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKWWWrWWWKKKKKKKKKKKKFFPPnnnnPnnnnPnnnnPnnnnFF.",
  ".FFKKWWWWWWWKKYYYrYYYYKKFFPPnrrnPnrrnPnrrnPnPPnFF.",
  ".FFKKWWWWWWWKKYYYYYYYYKKFFPPnrrnPnrrnPnrrnPnPPnFF.",
  ".FFKKWWWWWWWKKYYYYYYYYKKFFPPnnnnPnnnnPnnnnPnnnnFF.",
  ".FFKKWWWWWWWKKYYYYYYYYKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKWWWWWWWKKYYYYYYYYKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKKKKKKKKKKKKKKKKKKKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKKKKKKKKKKKKKKKKKKKKFFPPnnnnPnnnnPnnnnPPPPPFF.",
  ".FFKKKKWWWWrWWWWKKKKKKKKFFPPnPPnPnPPnPnPPnPPPPPFF.",
  ".FFKKKKWWWWWWWWWKKKKKKKKFFPPnPPnPnPPnPnPPnPPPPPFF.",
  ".FFKKKKWWWWWWWWWKKKKKKKKFFPPnnnnPnnnnPnnnnPPPPPFF.",
  ".FFKKKKWWWWWWWWWKKKKKKKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKKKWWWWWWWWWKKKKKKKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKKKWWWWWWWWWKKKKKKKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKKKKKKKKKKKKKKKKKKKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFKKKKKKKKKKKKKKKKKKKKKFFPPPPPPPPPPPPPPPPPPPPPFF.",
  ".FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.",
  ".FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF.",
  ...Array.from({ length: 10 }, () => "....NN......................................NN...."),
];
const LEGACY_BOARD_PALETTE = { N: "#7a4a2a", F: "#9a6a3a", R: "#6b4226", K: "#c9935a", P: "#fbeed4", W: "#ffffff", Y: "#fff3a0", r: "#e74c3c", n: "#b07a4a" };

// 개편 전 pondArt() (0번 그림은 그대로여야 한다)
const LEGACY_POND_ROWS = [
  "........................................",
  "........................................",
  "..............SLLLLLLLLLLS..............",
  ".........SLLLLLLLLLLLLLLLLLLLLS.........",
  ".......SLLLLLLLLLLLLLLLLLLLLLLLLS.......",
  ".....SLLLLLLLLLLLLLLLLLLLLLLLLLLLLS.....",
  "...SWWWWWWWWWWWWWWWWWWGGWWWWWWWWWWWWS...",
  "..SWWWWWWWWWWWWWWWWWWWGGWWWWWWGPGWWWWS..",
  ".SWWWWWWWWWWWWWWWWWWWWWWWWWWRnGGGWWWWWS.",
  ".SWWWWWWLLLLWWWWWWWWWWWWWWWRWnWWWWWWWWS.",
  ".SWWWWWWWWWWWWWWWWWWWWWWWWRWWWWWWWWWWWS.",
  ".SWWWWWWWWWWWWWWWWWWWWWWWRWWWFWWWWWWWWS.",
  ".SWWWWWWWWWWWWWWWWWWWWWWRWLLLLLWWWWWWWS.",
  ".SWWWWGGGWWWWWWWWWWWWWWRWWWWWWWWWWWWWWS.",
  "..SWWWGGGWWWWWWWWdDDDDdWWWWWWWWWWWWWWS..",
  "...SWWWWWWWWWWLLLddddddWWWWWWWWWWWWWS...",
  ".....SWWWWWWWWWWWdDDDDdWWWWWWWWWWWS.....",
  ".......SWWWWWWWWWddddddWWWWWWWWWS.......",
  ".........SWWWWWWWdDDDDdWWWWWWWS.........",
  "..............SWWddddddWWS..............",
  ".................dDDDDd.................",
  ".................dddddd.................",
];

const count = (a: PixelArt, ch: string) => a.rows.join("").split(ch).length - 1;
/** 그림의 모든 칸이 팔레트에 있는 글자(또는 빈 칸 '.')이고 줄 길이가 같다 */
const wellFormed = (a: PixelArt) => {
  const width = a.rows[0].length;
  return a.rows.every((r) => r.length === width && [...r].every((c) => c === "." || c in a.palette));
};
const house = (lot: number, extra: Partial<TownHouseInput> = {}): TownHouseInput => ({
  lot,
  slug: `blog${lot}`,
  nickname: `주민${lot}`,
  blogTitle: `블로그 ${lot}`,
  stage: 2,
  roof: ROOF_HEX.red,
  mine: false,
  ...extra,
});

describe("살아 있는 게시판 boardArt(쪽지, 도장)", () => {
  it("기본 (3, 3)은 개편 전 그림과 칸·팔레트가 똑같다", () => {
    expect(boardArt()).toEqual({ rows: LEGACY_BOARD_ROWS, palette: LEGACY_BOARD_PALETTE });
    expect(boardArt(3, 3)).toEqual(boardArt());
  });
  it("쪽지 수만큼 압정, 도장 수만큼 빨간 도장 (범위 밖은 0~최대로 자른다)", () => {
    // 도장 칸 하나는 빨간 2×2 = 4칸, 압정은 1칸
    for (const papers of [0, 1, 4, 5]) expect(count(boardArt(papers, 0), "r")).toBe(papers);
    for (const stamps of [0, 5, 7]) expect(count(boardArt(0, stamps), "r")).toBe(stamps * 4);
    expect(boardArt(99, 99)).toEqual(boardArt(BOARD_MAX.papers, BOARD_MAX.stamps));
    expect(boardArt(-2, -1)).toEqual(boardArt(0, 0));
    expect(count(boardArt(0, 0), "W") + count(boardArt(0, 0), "Y")).toBe(0);
  });
  it("넷째·다섯째 쪽지 색은 그 쪽지가 있을 때만 팔레트에 들어가고, 크기는 늘 50×34칸", () => {
    expect(boardArt(3, 3).palette).not.toHaveProperty("Q");
    expect(boardArt(4, 3).palette).toHaveProperty("Q");
    expect(boardArt(4, 3).palette).not.toHaveProperty("B");
    expect(boardArt(5, 3).palette).toHaveProperty("B");
    for (const [p, s] of [
      [0, 0],
      [5, 7],
    ]) {
      const a = boardArt(p, s);
      expect([a.rows.length, a.rows[0].length]).toEqual([34, 50]);
      expect(wellFormed(a)).toBe(true);
    }
  });
});

describe("움직이는 물 (분수 3장·연못 2장)", () => {
  it("분수 그림은 장마다 크기가 같고, 장마다 다르며, 3장 주기로 돈다", () => {
    const frames = Array.from({ length: FOUNTAIN_FRAMES }, (_, f) => fountainArt(f));
    for (const f of frames) {
      expect([f.rows.length, f.rows[0].length]).toEqual([22, 30]);
      expect(wellFormed(f)).toBe(true);
    }
    expect(new Set(frames.map((f) => f.rows.join("\n"))).size).toBe(FOUNTAIN_FRAMES);
    expect(fountainArt(FOUNTAIN_FRAMES)).toEqual(fountainArt(0));
    expect(fountainArt()).toEqual(fountainArt(0));
  });
  it("연못 0번 그림은 개편 전 그대로, 1번은 크기가 같고 물결만 다르다", () => {
    expect(pondArt().rows).toEqual(LEGACY_POND_ROWS);
    const moved = pondArt(1);
    expect(POND_FRAMES).toBe(2);
    expect([moved.rows.length, moved.rows[0].length]).toEqual([22, 40]);
    expect(moved.rows).not.toEqual(LEGACY_POND_ROWS);
    expect(moved.palette).toEqual(pondArt(0).palette);
    expect(wellFormed(moved)).toBe(true);
  });
  it("배치의 분수·연못은 움직이는 그림을 갖고, 0번이 기본 그림이다", () => {
    const { structures } = townLayout([], true);
    const fountain = structures.find((s) => s.id === "fountain")!;
    const pond = structures.find((s) => s.id === "pond")!;
    expect(fountain.frames).toHaveLength(FOUNTAIN_FRAMES);
    expect(pond.frames).toHaveLength(POND_FRAMES);
    expect(fountain.frames![0]).toBe(fountain.art);
    expect(pond.frames![0]).toBe(pond.art);
  });
});

describe("글 쓴 집에 불이 켜진다", () => {
  it("불 켜진 집 그림은 유리(G) 색만 바뀌고 칸은 그대로", () => {
    const art = houseArt(2, ROOF_HEX.red);
    const lit = litHouseArt(art);
    expect(lit.rows).toBe(art.rows);
    expect(lit.palette.G).toBe(LIT_GLASS);
    expect({ ...lit.palette, G: art.palette.G }).toEqual(art.palette);
  });
  it("창 덩어리는 단계마다 늘고, 굴뚝 꼭대기는 'c' 줄 가운데", () => {
    expect([1, 2, 3].map((s) => cellGroups(houseArt(s, ROOF_HEX.red), "G").length)).toEqual([1, 2, 3]);
    for (const s of [1, 2, 3]) {
      const art = houseArt(s, ROOF_HEX.red);
      const top = chimneyTop(art)!;
      expect(art.rows.slice(0, top.y).some((r) => r.includes("c"))).toBe(false);
      expect(art.rows[top.y][Math.floor(top.x)]).toBe("c");
    }
    expect(chimneyTop({ rows: ["..", ".."], palette: {} })).toBeNull();
  });
  it("덧칠 그림은 고른 글자 칸만 남긴다", () => {
    const glass = glowCells({ rows: ["GaG", "aGa"], palette: { G: "#000", a: "#111" } }, "G", "#fff");
    expect(glass).toEqual({ rows: ["G.G", ".G."], palette: { G: "#fff" } });
    expect(cellGroups(glass, "G")).toHaveLength(3);
  });
  it("굴뚝 연기는 3장, 같은 크기, 장마다 다르고 음수 장도 돈다", () => {
    const frames = Array.from({ length: SMOKE_FRAMES }, (_, f) => smokeArt(f));
    for (const f of frames) {
      expect([f.rows.length, f.rows[0].length]).toEqual([12, 9]);
      expect(wellFormed(f)).toBe(true);
    }
    expect(new Set(frames.map((f) => f.rows.join(""))).size).toBe(SMOKE_FRAMES);
    expect(smokeArt(-1)).toEqual(smokeArt(SMOKE_FRAMES - 1));
  });
  it("글 쓴 이웃 집은 lit, 우체통 깃발. 글 안 쓴 집·내 집은 그대로 (내 깃발은 안 읽은 알림)", () => {
    const { structures } = townLayout([house(1, { fresh: true, latestTitle: "새 글" }), house(2), house(3, { mine: true, fresh: true })], true, false);
    const at = (id: string) => structures.find((s) => s.id === id)!;
    expect(at("house:1").lit).toBe(true);
    expect(at("house:1").art.palette.G).toBe(LIT_GLASS);
    expect(at("house:2").lit).toBeUndefined();
    expect(at("house:2").art.palette.G).not.toBe(LIT_GLASS);
    expect(at("mailbox:1").art).toEqual(mailboxArt(false, true));
    expect(at("mailbox:2").art).toEqual(mailboxArt(false, false));
    expect(at("house:3").lit).toBe(true);
    expect(at("mailbox:3").art).toEqual(mailboxArt(true, false));
    expect(townLayout([house(3, { mine: true })], true, true).structures.find((s) => s.id === "mailbox:3")!.art).toEqual(mailboxArt(true, true));
  });
});

describe("마을 배치 (광장 개편)", () => {
  it("가로등은 켠 등이 기본(예전 그림), 끄면 유리 색만 다르다", () => {
    expect(lampArt()).toEqual(lampArt(true));
    expect(lampArt(true).palette.L).toBe("#ffe28a");
    expect(lampArt(false).rows).toEqual(lampArt(true).rows);
    expect(lampArt(false).palette.L).not.toBe(lampArt(true).palette.L);
  });
  it("숲 나무는 하늘·산 띠(y < 110)에 심지 않는다", () => {
    const trees = townLayout([], true).structures.filter((s) => s.id.startsWith("tree"));
    expect(trees.length).toBeGreaterThan(20);
    expect(trees.every((t) => t.y >= TREE_MIN_Y)).toBe(true);
  });
  it("이름표 모양: 건물은 나무 간판, 집은 문패, 빈 집터는 팻말", () => {
    const { structures } = townLayout([house(1)], true);
    const tag = (id: string) => structures.find((s) => s.id === id)?.tag;
    for (const id of ["board", "shop", "clothes", "salon", "farm", "pond"]) expect(tag(id)).toBe("sign");
    expect(tag("house:1")).toBe("plate");
    expect(tag("lot:2")).toBe("lot");
  });
  it("게시판 쪽지·도장 수를 받으면 그 그림으로 세운다", () => {
    const board = townLayout([], true, false, false, { papers: 5, stamps: 7 }).structures.find((s) => s.id === "board")!;
    expect(board.art).toEqual(boardArt(5, 7));
    expect(townLayout([], true).structures.find((s) => s.id === "board")!.art).toEqual(boardArt());
  });
});

describe("캔버스 글씨", () => {
  it("정수 배율이면 갈무리 12px × 배율, 아니면 Pretendard 13px", () => {
    const families = { pixel: "Galmuri11", sans: "Pretendard" };
    expect(tagFont(1, families)).toEqual({ font: "700 12px Galmuri11", pixel: true });
    expect(tagFont(2, families)).toEqual({ font: "700 24px Galmuri11", pixel: true });
    expect(tagFont(1.5, families)).toEqual({ font: "600 19.5px Pretendard", pixel: false });
  });
  it("말풍선 글은 ✎ 다음 제목, 공백을 하나로 접고 14자에서 줄인다", () => {
    expect(bubbleText("  된장찌개   황금 비율 ")).toBe("✎ 된장찌개 황금 비율");
    expect(bubbleText("가".repeat(BUBBLE_CHARS + 3))).toBe(`✎ ${"가".repeat(BUBBLE_CHARS)}…`);
  });
  it("이름표 높이는 테두리·여백·글줄, 말풍선은 꼬리만큼 더", () => {
    const base = TAG_BOX.border * 2 + TAG_BOX.padY * 2 + TAG_BOX.line;
    expect(tagHeight("plate")).toBe(base);
    expect(tagHeight("sign")).toBe(base);
    expect(tagHeight("bubble")).toBe(base + TAG_BOX.tail);
  });
});
