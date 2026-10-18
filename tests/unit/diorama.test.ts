import { describe, expect, it } from "vitest";
import { houseArt, HOUSE_ART_WIDTH } from "@/lib/art/town";
import {
  DIORAMA_MAX_HOUSES,
  DIORAMA_PAD,
  DIORAMA_SLOT,
  dioramaScene,
  dioramaWidth,
  haloArt,
  LIT_GLASS,
  LIT_GLOW,
  PHONE_DIORAMA_HOUSES,
  phonePlazaHouses,
  smokeFrame,
  SMOKE_FRAMES,
  tintArt,
  tintHex,
} from "@/lib/town/diorama";
import { SKY_TINT } from "@/lib/town/sky";

const rowsOk = (art: { rows: readonly string[]; palette: Readonly<Record<string, string>> }) => {
  const w = art.rows[0].length;
  expect(art.rows.every((r) => r.length === w)).toBe(true);
  // 그림에 쓴 글자는 모두 팔레트에 있다
  for (const ch of new Set(art.rows.join("").replaceAll(".", ""))) expect(art.palette[ch], ch).toBeDefined();
};

describe("작은 마을 그림 (광장 개편)", () => {
  it("낮은 덧칠하지 않고, 밤·노을·새벽은 multiply로 어두워진다", () => {
    expect(tintHex("#7cc46a", "day")).toBe("#7cc46a");
    for (const sky of ["dawn", "dusk", "night"] as const) {
      const out = tintHex("#ffffff", sky);
      const t = SKY_TINT[sky]!;
      // 흰색 × 덧칠 = 덧칠 색 쪽으로 alpha만큼
      const expectR = Math.round(255 * (1 - t.alpha + (t.alpha * parseInt(t.color.slice(1, 3), 16)) / 255));
      expect(parseInt(out.slice(1, 3), 16)).toBe(expectR);
    }
    expect(tintHex("not-a-color", "night")).toBe("not-a-color");
  });

  it("불빛 칸은 덧칠하지 않는다", () => {
    const art = tintArt({ rows: ["GW"], palette: { G: "#bfe6ff", W: "#fbeed4" } }, "night", { G: LIT_GLOW });
    expect(art.palette.G).toBe(LIT_GLOW);
    expect(art.palette.W).not.toBe("#fbeed4");
  });

  it("그림 폭은 자리 수에 맞추고, 집은 최대 5채", () => {
    expect(dioramaWidth(3)).toBe(DIORAMA_PAD * 2 + DIORAMA_SLOT * 3);
    expect(dioramaWidth(0)).toBe(dioramaWidth(1));
    const many = Array.from({ length: 8 }, () => ({ stage: 1, roof: "#d9534f" }));
    expect(dioramaScene(many, "day").houses).toHaveLength(DIORAMA_MAX_HOUSES);
  });

  it("집 밑변을 한 줄에 맞추고, 하늘·땅 그림은 그림 크기와 같다", () => {
    const scene = dioramaScene(
      [
        { stage: 1, roof: "#d9534f" },
        { stage: 3, roof: "#4a6fd9" },
        { stage: 6, roof: "#f0883e" },
      ],
      "dusk",
    );
    expect(scene.width).toBe(dioramaWidth(3));
    expect(scene.backdrop.rows).toHaveLength(scene.height);
    rowsOk(scene.backdrop);
    for (const h of scene.houses) {
      expect(h.y + h.art.rows.length).toBe(scene.baseY);
      expect(h.x).toBeGreaterThanOrEqual(0);
      expect(h.x + HOUSE_ART_WIDTH).toBeLessThanOrEqual(scene.width);
    }
    // 가로등은 집 사이에 둘
    expect(scene.front.filter((p) => p.art.rows.length === 22)).toHaveLength(2);
  });

  it("글 쓴 집만 창에 불이 켜지고 굴뚝 연기가 오른다 (낮은 따뜻한 노랑, 밤은 불빛 색과 둘레 빛)", () => {
    const day = dioramaScene(
      [
        { stage: 2, roof: "#d9534f", fresh: true },
        { stage: 2, roof: "#d9534f" },
      ],
      "day",
    );
    expect(day.houses.map((h) => h.lit)).toEqual([true, false]);
    expect(day.houses[0].art.palette.G).toBe(LIT_GLASS);
    expect(day.houses[1].art.palette.G).toBe(houseArt(2, "#d9534f").palette.G);
    expect(day.houses[0].smoke).toHaveLength(SMOKE_FRAMES);
    expect(day.houses[1].smoke).toBeNull();
    // 낮에는 빛 무리가 없다 (가로등 꺼짐)
    expect(day.glows).toHaveLength(0);

    const night = dioramaScene([{ stage: 2, roof: "#d9534f", fresh: true }], "night");
    expect(night.houses[0].art.palette.G).toBe(LIT_GLOW);
    expect(night.glows.length).toBeGreaterThan(0);
  });

  it("창 둘레 빛은 창 칸을 빼고 바로 옆 한 칸만", () => {
    const halo = haloArt({ rows: ["...", ".G.", "..."], palette: { G: "#fff" } }, "G", LIT_GLOW);
    expect(halo.rows).toEqual([".h.", "h.h", ".h."]);
  });

  it("굴뚝 연기 세 장은 크기가 같고 서로 다르다", () => {
    const frames = Array.from({ length: SMOKE_FRAMES }, (_, f) => smokeFrame(f));
    for (const f of frames) {
      expect(f.rows).toHaveLength(12);
      rowsOk(f);
    }
    expect(new Set(frames.map((f) => f.rows.join("|"))).size).toBe(SMOKE_FRAMES);
    expect(smokeFrame(SMOKE_FRAMES)).toEqual(frames[0]);
  });

  it("휴대폰 광장 머리 그림: 내 집 + 가장 최근에 글 쓴 불 켜진 이웃 2채, 모자라면 자리 순 (3채까지)", () => {
    const at = (h: number) => [{ createdAt: new Date(Date.UTC(2026, 9, 17, h)).toISOString() }];
    const houses = [
      { lot: 1, mine: false, fresh: false, recentPosts: at(1) },
      { lot: 0, mine: true, fresh: true, recentPosts: at(9) },
      { lot: 2, mine: false, fresh: true, recentPosts: at(3) },
      { lot: 3, mine: false, fresh: false, recentPosts: [] },
      { lot: 4, mine: false, fresh: true, recentPosts: at(8) },
      { lot: 5, mine: false, fresh: true, recentPosts: at(5) },
    ];
    expect(PHONE_DIORAMA_HOUSES).toBe(3);
    expect(phonePlazaHouses(houses).map((h) => h.lot)).toEqual([0, 4, 5]);
    // 불 켜진 이웃이 하나뿐이면 나머지는 자리 순
    const quiet = houses.map((h) => (h.lot === 4 || h.lot === 5 ? { ...h, fresh: false } : h));
    expect(phonePlazaHouses(quiet).map((h) => h.lot)).toEqual([0, 2, 1]);
    // 내 집이 없어도 (집 자리 전) 이웃만 3채
    expect(phonePlazaHouses(houses.filter((h) => !h.mine)).map((h) => h.lot)).toEqual([4, 5, 2]);
    expect(phonePlazaHouses([])).toEqual([]);
  });
});

describe("작은 마을 그림 계절·줄등 (plaza-upgrade-2 C5)", () => {
  const three = [
    { stage: 1, roof: "#d9534f", fresh: true },
    { stage: 3, roof: "#4a6fd9" },
    { stage: 6, roof: "#f0883e", fresh: true },
  ];
  it("계절 팔레트: 여름(기본)은 그대로, 겨울은 눈 덮인 땅·나무, 가을은 단풍 나무", async () => {
    const { seasonLand, seasonTreeArt } = await import("@/lib/town/diorama");
    expect(seasonLand(undefined)).toEqual(seasonLand("summer"));
    expect(seasonLand("winter").grass).not.toBe(seasonLand("summer").grass);
    expect(seasonTreeArt(0, "autumn").palette.L).not.toBe(seasonTreeArt(0, undefined).palette.L);
    const winter = dioramaScene(three, "day", { season: "winter" });
    const plain = dioramaScene(three, "day");
    expect(winter.season).toBe("winter");
    expect(plain.season).toBeNull();
    expect(winter.backdrop.palette.G).toBe(seasonLand("winter").grass);
    expect(plain.backdrop.palette.G).toBe(seasonLand(undefined).grass);
  });

  it("줄등: 하늘을 더 두고, 집 가운데마다 초롱 하나, 글 쓴 집만 켜진다. 가운데가 2칸 처진다", async () => {
    const { stringY, LANTERN_SAG, LANTERN_SIZE } = await import("@/lib/town/diorama");
    const off = dioramaScene(three, "night");
    const on = dioramaScene(three, "night", { lanterns: true });
    expect(off.string).toBeNull();
    expect(on.baseY).toBeGreaterThan(off.baseY);
    expect(on.string!.lanterns.map((l) => l.lit)).toEqual([true, false, true]);
    on.string!.lanterns.forEach((l, i) => {
      expect(l.x + LANTERN_SIZE.width / 2).toBe(on.houses[i].center);
      // 초롱 아래 끝이 가장 높은 집 지붕보다 위
      expect(l.y + LANTERN_SIZE.height).toBeLessThanOrEqual(Math.min(...on.houses.map((h) => h.y)));
    });
    expect(stringY(0, 100, 2, LANTERN_SAG)).toBe(2);
    expect(stringY(50, 100, 2, LANTERN_SAG)).toBe(2 + LANTERN_SAG);
  });
});
