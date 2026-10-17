import { describe, expect, it } from "vitest";
import { pixelPaths } from "@/lib/art/paths";
import { kstHour, lampsOn, msUntilNextSky, parseSky, skyAt, SKY_TINT } from "@/lib/town/sky";
import { parseReturnSpot, townReturnHref, zoneAt } from "@/lib/town/zones";
import { CENTER, GARDEN, POND_POS, START_POS } from "@/lib/town/layout";

/** 한국 시각 h:m (UTC+9) */
const kst = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 17, h - 9, m));

describe("마을 하늘 (광장 개편)", () => {
  it("한국 시각을 시 단위로", () => {
    expect(kstHour(kst(14, 30))).toBe(14.5);
    expect(kstHour(kst(0, 0))).toBe(0);
  });

  it("새벽 05~07, 낮 07~17, 노을 17~19, 밤 19~05 (앞 포함·뒤 뺌)", () => {
    expect(skyAt(kst(4, 59))).toBe("night");
    expect(skyAt(kst(5, 0))).toBe("dawn");
    expect(skyAt(kst(6, 59))).toBe("dawn");
    expect(skyAt(kst(7, 0))).toBe("day");
    expect(skyAt(kst(16, 59))).toBe("day");
    expect(skyAt(kst(17, 0))).toBe("dusk");
    expect(skyAt(kst(18, 59))).toBe("dusk");
    expect(skyAt(kst(19, 0))).toBe("night");
    expect(skyAt(kst(23, 30))).toBe("night");
  });

  it("가로등은 낮만 끈다, 낮은 덧칠하지 않는다", () => {
    expect(lampsOn("day")).toBe(false);
    expect(lampsOn("dusk")).toBe(true);
    expect(lampsOn("night")).toBe(true);
    expect(lampsOn("dawn")).toBe(true);
    expect(SKY_TINT.day).toBeNull();
    expect(SKY_TINT.night).not.toBeNull();
  });

  it("주소 값은 아는 하늘만", () => {
    expect(parseSky("night")).toBe("night");
    expect(parseSky("noon")).toBeNull();
    expect(parseSky(["night"])).toBeNull();
    expect(parseSky(undefined)).toBeNull();
  });

  it("다음 하늘까지 남은 시간", () => {
    expect(msUntilNextSky(kst(16, 0))).toBe(3_600_000);
    expect(msUntilNextSky(kst(20, 0))).toBe(9 * 3_600_000);
    expect(msUntilNextSky(kst(4, 30))).toBe(30 * 60_000);
  });
});

describe("마을 구역과 돌아올 자리", () => {
  it("광장·정원·연못", () => {
    expect(zoneAt(START_POS)).toBe("plaza");
    expect(zoneAt(CENTER)).toBe("plaza");
    expect(zoneAt({ x: GARDEN.x + 100, y: GARDEN.y + 100 })).toBe("garden");
    expect(zoneAt(POND_POS)).toBe("pond");
  });

  it("광장으로 돌아오는 주소", () => {
    expect(townReturnHref("shop")).toBe("/town?from=shop");
    expect(townReturnHref(null)).toBe("/town");
    expect(parseReturnSpot("pond")).toBe("pond");
    expect(parseReturnSpot("admin")).toBeNull();
  });
});

describe("도트 그림 SVG path", () => {
  it("색마다 path 하나, 같은 색 가로 칸은 한 조각", () => {
    const paths = pixelPaths([{ rows: ["aab", ".a."], palette: { a: "#111", b: "#222" } }]);
    expect(paths).toEqual([
      { fill: "#111", d: "M0 0h2v1h-2zM1 1h1v1h-1z" },
      { fill: "#222", d: "M2 0h1v1h-1z" },
    ]);
  });
});
