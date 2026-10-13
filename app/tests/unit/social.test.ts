import { describe, expect, it } from "vitest";
import { FAVORITE_LIMIT, FAVORITE_MESSAGES, favoriteRefusal, favoriteWindowStart } from "@/lib/social";

describe("favoriteWindowStart (오늘 포함 한국 날짜 7일)", () => {
  it("한국 오후면 6일 전 한국 0시", () => {
    // 2026-10-12 15:00 KST
    expect(favoriteWindowStart(new Date("2026-10-12T06:00:00Z")).toISOString()).toBe("2026-10-05T15:00:00.000Z");
  });
  it("UTC로는 전날이어도 한국 날짜로 센다", () => {
    // 2026-10-12 00:30 KST = 2026-10-11 15:30Z
    expect(favoriteWindowStart(new Date("2026-10-11T15:30:00Z")).toISOString()).toBe("2026-10-05T15:00:00.000Z");
    // 2026-10-11 23:59 KST
    expect(favoriteWindowStart(new Date("2026-10-11T14:59:00Z")).toISOString()).toBe("2026-10-04T15:00:00.000Z");
  });
  it("달이 바뀌어도", () => {
    expect(favoriteWindowStart(new Date("2026-03-03T03:00:00Z")).toISOString()).toBe("2026-02-24T15:00:00.000Z");
  });
});

describe("favoriteRefusal", () => {
  it("끄기는 늘 된다 (공지 블로그·10명이어도)", () => {
    expect(favoriteRefusal({ turningOn: false, isNotice: true, count: 10 })).toBeNull();
  });
  it("공지 블로그는 켤 수 없다", () => {
    expect(favoriteRefusal({ turningOn: true, isNotice: true, count: 0 })).toBe(FAVORITE_MESSAGES.notice);
  });
  it("10명까지", () => {
    expect(favoriteRefusal({ turningOn: true, isNotice: false, count: FAVORITE_LIMIT - 1 })).toBeNull();
    expect(favoriteRefusal({ turningOn: true, isNotice: false, count: FAVORITE_LIMIT })).toBe(FAVORITE_MESSAGES.full);
    expect(FAVORITE_MESSAGES.full).toBe("즐겨찾기는 10명까지예요. 다른 이웃의 ⭐를 먼저 꺼 주세요.");
  });
});
