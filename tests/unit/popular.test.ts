import { describe, expect, it } from "vitest";
import { comparePopular, parsePopularRange, popularScore, popularWindow } from "@/lib/popular";

describe("🔥 인기 글", () => {
  it("점수는 조회 + 공감 ×3 + 댓글 ×2", () => {
    expect(popularScore({ views: 0, likes: 0, comments: 0 })).toBe(0);
    expect(popularScore({ views: 10, likes: 2, comments: 3 })).toBe(10 + 6 + 6);
    // 공감 1개는 조회 3번, 댓글 1개는 조회 2번과 같다
    expect(popularScore({ views: 0, likes: 1, comments: 0 })).toBe(popularScore({ views: 3, likes: 0, comments: 0 }));
    expect(popularScore({ views: 0, likes: 0, comments: 1 })).toBe(popularScore({ views: 2, likes: 0, comments: 0 }));
  });

  it("기간 탭: 모르는 값·없으면 이번 주", () => {
    expect(parsePopularRange("today")).toBe("today");
    expect(parsePopularRange("month")).toBe("month");
    expect(parsePopularRange(["today", "month"])).toBe("today");
    expect(parsePopularRange(undefined)).toBe("week");
    expect(parsePopularRange("year")).toBe("week");
    expect(parsePopularRange("")).toBe("week");
  });

  it("기간은 한국 날짜로 오늘 포함 1·7·30일, 시작은 첫날 한국 0시", () => {
    // 한국 2026-10-14 08:30 (UTC로는 13일 23:30)
    const now = new Date("2026-10-13T23:30:00Z");
    expect(popularWindow("today", now)).toEqual({ startDay: "2026-10-14", startAt: new Date("2026-10-13T15:00:00Z") });
    expect(popularWindow("week", now).startDay).toBe("2026-10-08");
    expect(popularWindow("month", now).startDay).toBe("2026-09-15");
    expect(popularWindow("month", now).startAt.toISOString()).toBe("2026-09-14T15:00:00.000Z");
    // 한국 자정 직전은 아직 그날
    expect(popularWindow("today", new Date("2026-10-14T14:59:59Z")).startDay).toBe("2026-10-14");
    expect(popularWindow("today", new Date("2026-10-14T15:00:00Z")).startDay).toBe("2026-10-15");
  });

  it("점수 높은 순, 같으면 새 글(늦게 쓴 글, 그다음 큰 번호) 먼저", () => {
    const old = new Date("2026-10-01T00:00:00Z");
    const recent = new Date("2026-10-10T00:00:00Z");
    const rows = [
      { id: 1, score: 5, createdAt: recent },
      { id: 2, score: 9, createdAt: old },
      { id: 3, score: 5, createdAt: old },
      { id: 4, score: 5, createdAt: recent },
    ];
    expect([...rows].sort(comparePopular).map((r) => r.id)).toEqual([2, 4, 1, 3]);
  });
});
