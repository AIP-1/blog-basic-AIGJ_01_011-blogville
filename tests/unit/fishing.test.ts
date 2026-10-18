import { describe, expect, it } from "vitest";
import { CATCHES, pickCatch, prizeLine, todayLine } from "@/lib/fishing";

describe("연못 낚시터 (TOWN-14)", () => {
  it("무게 합 100, 0은 송사리, 99는 낡은 장화, 표 순서대로 누적", () => {
    expect(CATCHES.reduce((n, c) => n + c.weight, 0)).toBe(100);
    expect(pickCatch(0)).toBe("minnow");
    expect(pickCatch(24)).toBe("minnow");
    expect(pickCatch(25)).toBe("crucian");
    expect(pickCatch(70)).toBe("golden_carp");
    expect(pickCatch(73)).toBe("feed");
    expect(pickCatch(99)).toBe("boot");
    const counts: Record<string, number> = {};
    for (let r = 0; r < 100; r++) counts[pickCatch(r)] = (counts[pickCatch(r)] ?? 0) + 1;
    expect(counts).toEqual({ minnow: 25, crucian: 30, carp: 15, golden_carp: 3, feed: 15, boot: 12 });
  });
  it("받은 것 줄은 숫자 소리에 맞춰 을/를", () => {
    expect(prizeLine("minnow")).toBe("🪙 5를 받았어요.");
    expect(prizeLine("crucian")).toBe("🪙 15를 받았어요.");
    expect(prizeLine("carp")).toBe("🪙 30을 받았어요.");
    expect(prizeLine("golden_carp")).toBe("🪙 100을 받았어요.");
    expect(prizeLine("boot")).toBe("🪙 1을 받았어요.");
    expect(prizeLine("feed")).toBe("동물 먹이 1개를 받았어요.");
  });
  it("오늘 낚은 것 줄", () => {
    expect(todayLine("crucian")).toBe("오늘은 붕어를 낚았어요.");
    expect(todayLine("carp")).toBe("오늘은 잉어를 낚았어요.");
    expect(todayLine("boot")).toBe("오늘은 낡은 장화를 낚았어요.");
  });
});

describe("낚시 도감 (plaza-upgrade-2 C3)", () => {
  it("묶은 줄 → 표 순서 여섯 칸, 횟수·처음 낚은 날, 못 낚은 칸은 0과 null", async () => {
    const { catchBook, dexProgress } = await import("@/lib/fishing-book");
    const cells = catchBook([
      { catch: "boot", count: 2, first: "2026-10-01" },
      { catch: "carp", count: 1, first: "2026-10-17" },
      { catch: "unknown", count: 9, first: "2026-01-01" },
    ]);
    expect(cells.map((c) => c.code)).toEqual(["minnow", "crucian", "carp", "golden_carp", "feed", "boot"]);
    expect(cells.find((c) => c.code === "boot")).toMatchObject({ count: 2, first: "2026-10-01", coin: 1 });
    expect(cells.find((c) => c.code === "carp")).toMatchObject({ count: 1, first: "2026-10-17" });
    expect(cells.find((c) => c.code === "minnow")).toMatchObject({ count: 0, first: null });
    expect(dexProgress(cells)).toBe("6종 중 2종");
    expect(dexProgress(catchBook([]))).toBe("6종 중 0종");
  });

  it("도감 도트: 줄 길이가 같고 모든 글자가 팔레트에 있다, 외곽선은 잉크색, 실루엣은 한 색", async () => {
    const { catchArt, silhouetteArt, FISH_OUTLINE } = await import("@/lib/art/fish");
    const sizes: Record<string, [number, number]> = { minnow: [8, 5], crucian: [10, 6], carp: [12, 7], golden_carp: [12, 7] };
    for (const c of CATCHES) {
      const art = catchArt(c.code);
      const w = art.rows[0].length;
      expect(art.rows.every((r) => r.length === w), c.code).toBe(true);
      for (const ch of new Set(art.rows.join("").replaceAll(".", ""))) expect(art.palette[ch], `${c.code} ${ch}`).toBeDefined();
      expect(art.palette.O).toBe(FISH_OUTLINE);
      if (sizes[c.code]) expect([w, art.rows.length]).toEqual(sizes[c.code]);
      expect(new Set(Object.values(silhouetteArt(art).palette))).toEqual(new Set([FISH_OUTLINE]));
    }
    expect(catchArt("minnow").palette.B).toBe("#a8b4bc");
    expect(catchArt("golden_carp").palette.s).toBe("#fff3c4");
  });
});
