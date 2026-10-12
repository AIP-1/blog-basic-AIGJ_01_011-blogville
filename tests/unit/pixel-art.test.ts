import { describe, expect, it } from "vitest";
import { CHARACTER_ART, pixelRects } from "@/lib/art/characters";

describe("도트 캐릭터 (GAME-01)", () => {
  it.each(Object.entries(CHARACTER_ART))("%s는 16×16이고 모든 글자에 색이 있다", (_, art) => {
    expect(art.rows).toHaveLength(16);
    for (const row of art.rows) {
      expect(row).toHaveLength(16);
      for (const ch of row) if (ch !== ".") expect(art.palette[ch]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it("같은 색이 이어지면 사각형 하나", () => {
    expect(pixelRects({ rows: ["..AAB.", "A....."], palette: { A: "#111111", B: "#222222" } })).toEqual([
      { x: 2, y: 0, width: 2, fill: "#111111" },
      { x: 4, y: 0, width: 1, fill: "#222222" },
      { x: 0, y: 1, width: 1, fill: "#111111" },
    ]);
  });
});
