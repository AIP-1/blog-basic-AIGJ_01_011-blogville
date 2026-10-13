import { describe, expect, it } from "vitest";
import { defaultScheduleValue, formatKstLocal, parseKstLocal, SCHEDULE_ERRORS, scheduleError } from "@/lib/schedule";

describe("예약 시간", () => {
  it("한국 시간 칸 값을 그 순간으로 읽고 되돌린다", () => {
    const at = parseKstLocal("2026-10-14T09:00")!;
    expect(at.toISOString()).toBe("2026-10-14T00:00:00.000Z");
    expect(formatKstLocal(at)).toBe("2026-10-14T09:00");
    expect(parseKstLocal("2026-10-14T00:30")!.toISOString()).toBe("2026-10-13T15:30:00.000Z");
  });

  it("모양이 틀리거나 없는 날짜는 null", () => {
    for (const v of ["", "2026-10-14", "2026-02-30T09:00", "2026-10-14T24:00", "2026-10-14 09:00", "x"]) expect(parseKstLocal(v)).toBeNull();
  });

  it("5분 뒤부터 90일 안까지", () => {
    const now = new Date("2026-10-13T00:00:00Z");
    expect(scheduleError(null, now)).toBe(SCHEDULE_ERRORS.invalid);
    expect(scheduleError(new Date("2026-10-13T00:02:00Z"), now)).toBe(SCHEDULE_ERRORS.tooSoon);
    expect(scheduleError(new Date("2026-10-13T00:05:00Z"), now)).toBeNull();
    expect(scheduleError(new Date("2027-01-10T00:00:00Z"), now)).toBeNull();
    expect(scheduleError(new Date("2027-01-12T00:00:00Z"), now)).toBe(SCHEDULE_ERRORS.tooLate);
  });

  it("처음 값은 다음 정각, 5분 안이면 그다음 정각", () => {
    expect(defaultScheduleValue(new Date("2026-10-13T00:10:00Z"))).toBe("2026-10-13T10:00");
    expect(defaultScheduleValue(new Date("2026-10-13T00:57:00Z"))).toBe("2026-10-13T11:00");
  });
});
