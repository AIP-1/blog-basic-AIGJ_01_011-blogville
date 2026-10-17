import { describe, expect, it } from "vitest";
import { artCells } from "@/lib/art/paths";
import { boardArt, clothesShopArt, farmArt, houseArt, pondArt, salonArt, shopArt } from "@/lib/art/town";
import { GAME_ROOMS, roomExitHref, roomHeading, trimArt, type GameRoomKey } from "@/lib/game-rooms";

describe("건물 안 화면 간판 (광장 개편, GamePageShell)", () => {
  it("h1 글자(textContent)는 `{이모지} {이름}` 그대로다 (e2e가 보는 문구)", () => {
    const expected: Record<GameRoomKey, string> = {
      shop: "🏪 마을 상점",
      clothes: "👗 꼬까 옷가게",
      salon: "💇 반짝 미용실",
      closet: "🎨 꾸미기",
      farm: "🐮 동물 농장",
      fishing: "🎣 연못 낚시터",
      attendance: "📮 출석 체크",
      wallet: "📒 경험치·코인 내역",
    };
    for (const key of Object.keys(GAME_ROOMS) as GameRoomKey[]) expect(roomHeading(key)).toBe(expected[key]);
  });

  it("[🚪 광장으로]는 그 건물 문 앞으로: 낚시터는 연못, 출석은 게시판, 꾸미기·내역은 그냥 광장", () => {
    expect(roomExitHref("shop")).toBe("/town?from=shop");
    expect(roomExitHref("clothes")).toBe("/town?from=clothes");
    expect(roomExitHref("salon")).toBe("/town?from=salon");
    expect(roomExitHref("farm")).toBe("/town?from=farm");
    expect(roomExitHref("fishing")).toBe("/town?from=pond");
    expect(roomExitHref("attendance")).toBe("/town?from=board");
    expect(roomExitHref("closet")).toBe("/town");
    expect(roomExitHref("wallet")).toBe("/town");
  });

  it("간판 그림은 둘레의 빈 칸만 잘라 낸다", () => {
    const art = { rows: ["....", ".AB.", "..A.", "...."], palette: { A: "#111111", B: "#222222" } };
    expect(trimArt(art).rows).toEqual(["AB", ".A"]);
    // 빈 칸이 없으면 그대로, 팔레트에 없는 글자도 빈 칸으로 본다
    expect(trimArt({ rows: ["AB"], palette: art.palette }).rows).toEqual(["AB"]);
    expect(trimArt({ rows: ["xA", "xx"], palette: art.palette }).rows).toEqual(["A"]);
  });

  it("건물 그림을 잘라도 칸 수가 줄기만 하고 모든 줄 길이가 같다", () => {
    for (const art of [shopArt(), clothesShopArt(), salonArt(), farmArt(), pondArt(), boardArt(), houseArt(1, "#d9534f"), houseArt(10, "#4a6fd9")]) {
      const trimmed = trimArt(art);
      const before = artCells(art);
      const after = artCells(trimmed);
      expect(after.width).toBeGreaterThan(0);
      expect(after.width).toBeLessThanOrEqual(before.width);
      expect(after.height).toBeLessThanOrEqual(before.height);
      expect(new Set(trimmed.rows.map((r) => r.length))).toEqual(new Set([after.width]));
    }
    // 1단계 오두막은 양옆 빈 자리를 잘라 그림 폭(40칸)보다 좁다
    expect(artCells(trimArt(houseArt(1, "#d9534f"))).width).toBeLessThan(40);
  });
});
