import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pixelPaths } from "@/lib/art/paths";
import { BRAND_GREEN, houseMarkArt, INK, PAGE_MARKS } from "@/lib/art/site";

const all = { house: houseMarkArt(), ...Object.fromEntries(Object.entries(PAGE_MARKS).map(([k, f]) => [k, f()])) };

describe("사이트 도트 그림 (로고 집·쪽 머리)", () => {
  it.each(Object.entries(all))("%s: 줄 길이가 같고, 쓴 글자는 모두 팔레트에 있고, 빈 테두리가 없다", (_, art) => {
    const w = art.rows[0].length;
    expect(art.rows.every((r) => r.length === w)).toBe(true);
    for (const ch of new Set(art.rows.join("").replaceAll(".", ""))) expect(art.palette[ch], ch).toBeDefined();
    expect(art.rows[0]).toMatch(/[^.]/);
    expect(art.rows.at(-1)).toMatch(/[^.]/);
    expect(art.rows.some((r) => r[0] !== ".")).toBe(true);
    expect(art.rows.some((r) => r[w - 1] !== ".")).toBe(true);
  });

  it("쪽 머리 그림은 머리 줄에 들어가는 크기 (칸 2px로 44px 폭·36px 높이 안)", () => {
    for (const f of Object.values(PAGE_MARKS)) {
      const a = f();
      expect(a.rows[0].length * 2).toBeLessThanOrEqual(44);
      expect(a.rows.length * 2).toBeLessThanOrEqual(36);
    }
  });

  it("집 마크: 지붕은 브랜드 초록, 먹선은 글자색을 따른다", () => {
    const mark = houseMarkArt();
    expect(mark.palette.R).toBe(BRAND_GREEN);
    expect(mark.palette.K).toBe("currentColor");
  });

  it("파비콘(icon.svg)은 집 마크와 같은 그림이다 (그림을 바꾸면 파일도 다시 만든다)", () => {
    const svg = readFileSync("src/app/icon.svg", "utf8");
    for (const p of pixelPaths([houseMarkArt({ ink: INK })])) expect(svg).toContain(`<path fill="${p.fill}" d="${p.d}"/>`);
  });
});
