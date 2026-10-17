import { describe, expect, it } from "vitest";
import { parseSeason, seasonAt } from "@/lib/town/season";

describe("seasonAt", () => {
  it("10월 17일(한국)은 가을", () => {
    expect(seasonAt(new Date("2026-10-17T12:00:00+09:00"))).toBe("autumn");
  });
  it("12월 1일(한국)은 겨울", () => {
    expect(seasonAt(new Date("2026-12-01T00:00:00+09:00"))).toBe("winter");
  });
  it("UTC 2월 28일 15:30은 한국 3월 1일이라 봄", () => {
    expect(seasonAt(new Date("2026-02-28T15:30:00Z"))).toBe("spring");
  });
});

describe("parseSeason", () => {
  it("모르는 값은 null", () => {
    expect(parseSeason("x")).toBeNull();
    expect(parseSeason(undefined)).toBeNull();
  });
  it("계절 이름은 그대로", () => {
    expect(parseSeason("winter")).toBe("winter");
  });
});
