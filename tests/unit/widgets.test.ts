import { describe, expect, it } from "vitest";
import { defaultLayout, dropWidget, layoutOf, moveWidget, WIDGETS } from "@/lib/widgets";

describe("layoutOf (위젯 배치 읽기)", () => {
  it("NULL·이상한 값이면 기본 배치 (모두 보이고, 날씨만 작게, 서울)", () => {
    for (const v of [null, undefined, "x", 3, [], { items: "x" }]) {
      const l = layoutOf(v);
      expect(l.items.map((it) => it.key)).toEqual(WIDGETS.map((w) => w.key));
      expect(l.items.every((it) => it.visible)).toBe(true);
      expect(l.items.find((it) => it.key === "weather")?.size).toBe("sm");
      expect(l.weather.city).toBe("seoul");
    }
  });
  it("저장한 순서를 지키고, 모르는 키·겹친 키는 버리고, 빠진 위젯은 뒤에 기본값으로", () => {
    const l = layoutOf({
      items: [
        { key: "tags", visible: false, size: "sm" },
        { key: "nope", visible: true },
        { key: "tags", visible: true, size: "lg" },
        { key: "recent", size: "sm" },
        { key: "rss", size: "sm" }, // 크기를 고를 수 없는 위젯은 늘 lg
      ],
      weather: { city: "busan" },
    });
    expect(l.items.slice(0, 3)).toEqual([
      { key: "tags", visible: false, size: "sm" },
      { key: "recent", visible: true, size: "sm" },
      { key: "rss", visible: true, size: "lg" },
    ]);
    expect(l.items).toHaveLength(WIDGETS.length);
    expect(l.items[3].key).toBe("guestbook");
    expect(l.weather.city).toBe("busan");
  });
  it("모르는 도시는 서울", () => {
    expect(layoutOf({ items: [], weather: { city: "tokyo" } }).weather.city).toBe("seoul");
  });
});

describe("moveWidget · dropWidget", () => {
  const items = defaultLayout().items.slice(0, 4);
  const keys = (list: typeof items) => list.map((it) => it.key);
  it("한 칸 위·아래, 끝이면 그대로", () => {
    expect(keys(moveWidget(items, "calendar", -1))).toEqual(["calendar", "guestbook", "weather", "stocks"]);
    expect(keys(moveWidget(items, "guestbook", -1))).toEqual(keys(items));
    expect(keys(moveWidget(items, "stocks", 1))).toEqual(keys(items));
  });
  it("끌어 놓으면 놓은 자리로", () => {
    expect(keys(dropWidget(items, "stocks", "guestbook"))).toEqual(["stocks", "guestbook", "calendar", "weather"]);
    expect(keys(dropWidget(items, "guestbook", "weather"))).toEqual(["calendar", "weather", "guestbook", "stocks"]);
  });
});
