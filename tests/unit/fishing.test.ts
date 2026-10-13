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
