import { describe, expect, it } from "vitest";
import { GUESTBOOK_HOURLY_LIMIT, GUESTBOOK_RATE_ERROR, guestbookRateRefusal } from "@/server/guestbook";

// 방명록 시간당 상한 (plaza-upgrade-2 B3: 광장 우체통 쪽지로 쓰는 길이 새로 생겨서)
describe("방명록 시간당 상한", () => {
  it("1시간에 10개까지: 10개를 이미 썼으면 11번째는 거절", () => {
    expect(GUESTBOOK_HOURLY_LIMIT).toBe(10);
    for (let n = 0; n < 10; n++) expect(guestbookRateRefusal(n)).toBeNull();
    expect(guestbookRateRefusal(10)).toBe(GUESTBOOK_RATE_ERROR);
    expect(guestbookRateRefusal(25)).toBe(GUESTBOOK_RATE_ERROR);
    expect(GUESTBOOK_RATE_ERROR).toContain("1시간에 10개");
  });
});
