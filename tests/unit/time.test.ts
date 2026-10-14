import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatTime, fullDateTime, nextRelativeChange, relativeTime } from "@/lib/time";

describe("formatDateTime · formatDate · formatTime (한국 시간, 분까지)", () => {
  it("24시간 표기", () => {
    expect(formatDateTime(new Date("2026-10-02T05:07:09Z"))).toBe("2026.10.02 14:07");
    expect(formatDateTime(new Date("2026-10-02T15:00:00Z"))).toBe("2026.10.03 00:00");
    expect(formatDate(new Date("2026-10-01T16:00:00Z"))).toBe("2026.10.02");
    expect(formatTime(new Date("2026-10-01T16:05:00Z"))).toBe("01:05");
  });
});

describe("fullDateTime (마우스를 올렸을 때)", () => {
  it("오전·오후, 12시", () => {
    expect(fullDateTime(new Date("2026-10-14T01:16:42Z"))).toBe("2026년 10월 14일 오전 10:16 (한국 시간)");
    expect(fullDateTime(new Date("2026-10-14T05:05:00Z"))).toBe("2026년 10월 14일 오후 2:05 (한국 시간)");
    expect(fullDateTime(new Date("2026-10-14T03:30:00Z"))).toBe("2026년 10월 14일 오후 12:30 (한국 시간)");
    expect(fullDateTime(new Date("2026-10-13T15:30:00Z"))).toBe("2026년 10월 14일 오전 12:30 (한국 시간)");
  });
  it("seconds면 초까지", () => {
    expect(fullDateTime(new Date("2026-10-14T01:16:42Z"), { seconds: true })).toBe("2026년 10월 14일 오전 10:16:42 (한국 시간)");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-10-14T01:30:00Z"); // 한국 10:30
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it("방금 전 · N분 전 · 오늘은 N시간 전", () => {
    expect(relativeTime(ago(30_000), now)).toBe("방금 전");
    expect(relativeTime(ago(12 * 60_000), now)).toBe("12분 전");
    expect(relativeTime(ago(3 * 3_600_000), now)).toBe("3시간 전");
    expect(relativeTime(ago(10 * 3_600_000 + 29 * 60_000), now)).toBe("10시간 전"); // 한국 00:01
  });
  it("한국 날짜로 어제면 `어제 HH:mm`, 그 전은 날짜와 시각", () => {
    expect(relativeTime(new Date("2026-10-13T14:59:00Z"), now)).toBe("어제 23:59");
    expect(relativeTime(new Date("2026-10-12T15:00:00Z"), now)).toBe("어제 00:00");
    expect(relativeTime(new Date("2026-10-12T14:59:00Z"), now)).toBe("2026.10.12 23:59");
  });
  it("자정 직후라도 1시간 안이면 분으로", () => {
    const midnight = new Date("2026-10-13T15:10:00Z"); // 한국 00:10
    expect(relativeTime(new Date("2026-10-13T14:50:00Z"), midnight)).toBe("20분 전");
    expect(relativeTime(new Date("2026-10-13T13:50:00Z"), midnight)).toBe("어제 22:50");
  });
  it("시계가 어긋나 미래면 방금 전", () => {
    expect(relativeTime(new Date(now.getTime() + 5_000), now)).toBe("방금 전");
  });
});

describe("nextRelativeChange", () => {
  const now = new Date("2026-10-14T01:30:00Z"); // 한국 10:30
  it("1시간 안은 다음 분, 오늘은 다음 시간, 자정이 먼저면 자정", () => {
    expect(nextRelativeChange(new Date(now.getTime() - 90_000), now)).toBe(30_000);
    expect(nextRelativeChange(new Date(now.getTime() - 3_600_000 - 60_000), now)).toBe(3_600_000 - 60_000);
    const late = new Date("2026-10-14T14:50:00Z"); // 한국 23:50
    expect(nextRelativeChange(new Date("2026-10-14T10:00:00Z"), late)).toBe(10 * 60_000);
  });
  it("그제 이전은 더 바뀌지 않는다", () => {
    expect(nextRelativeChange(new Date("2026-10-12T00:00:00Z"), now)).toBeNull();
  });
});
