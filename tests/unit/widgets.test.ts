import { describe, expect, it } from "vitest";
import { defaultLayout, dropWidget, layoutOf, moveWidget, splitColumns, widgetWeight, WIDGETS } from "@/lib/widgets";

describe("layoutOf (위젯 배치 읽기)", () => {
  it("NULL·이상한 값이면 기본 배치 (모두 보이고 크게)", () => {
    for (const v of [null, undefined, "x", 3, [], { items: "x" }]) {
      const l = layoutOf(v);
      expect(l.items.map((it) => it.key)).toEqual(WIDGETS.map((w) => w.key));
      expect(l.items.every((it) => it.visible)).toBe(true);
      expect(l.items.every((it) => it.size === "lg")).toBe(true);
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
    });
    expect(l.items.slice(0, 3)).toEqual([
      { key: "tags", visible: false, size: "sm" },
      { key: "recent", visible: true, size: "sm" },
      { key: "rss", visible: true, size: "lg" },
    ]);
    expect(l.items).toHaveLength(WIDGETS.length);
    expect(l.items[3].key).toBe("guestbook");
  });
});

describe("moveWidget · dropWidget", () => {
  const items = defaultLayout().items.slice(0, 4);
  const keys = (list: typeof items) => list.map((it) => it.key);
  it("한 칸 위·아래, 끝이면 그대로", () => {
    expect(keys(moveWidget(items, "calendar", -1))).toEqual(["calendar", "guestbook", "weather", "news"]);
    expect(keys(moveWidget(items, "guestbook", -1))).toEqual(keys(items));
    expect(keys(moveWidget(items, "stocks", 1))).toEqual(keys(items));
  });
  it("끌어 놓으면 놓은 자리로", () => {
    expect(keys(dropWidget(items, "news", "guestbook"))).toEqual(["news", "guestbook", "calendar", "weather"]);
    expect(keys(dropWidget(items, "guestbook", "weather"))).toEqual(["calendar", "weather", "guestbook", "news"]);
  });
});

describe("splitColumns (넓은 화면 옆 칸 두 줄)", () => {
  const w = (n: number) => n;
  it("순서를 지키고 높이 차이가 가장 작은 곳에서 자른다", () => {
    expect(splitColumns([5, 1, 1, 1, 2], w)).toEqual([[5], [1, 1, 1, 2]]);
    expect(splitColumns([1, 1, 1, 1], w)).toEqual([[1, 1], [1, 1]]);
  });
  it("하나뿐이거나 없으면 앞 줄에", () => {
    expect(splitColumns([3], w)).toEqual([[3], []]);
    expect(splitColumns([], w)).toEqual([[], []]);
  });
  it("기본 배치는 두 줄로 나뉘고 이어 붙이면 원래 순서", () => {
    const items = defaultLayout().items;
    const [a, b] = splitColumns(items, (it) => widgetWeight(it, 6));
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect([...a, ...b]).toEqual(items);
  });
});
