import { describe, expect, it } from "vitest";
import { checkComment, COMMENT_ERRORS, formatDateTime } from "@/lib/comment-rules";

describe("checkComment (SOC-01)", () => {
  it("앞뒤 공백을 지우고 줄바꿈을 맞춘다", () => {
    expect(checkComment("  안녕\r\n하세요  ")).toEqual({ ok: true, content: "안녕\n하세요" });
  });
  it.each([
    ["", COMMENT_ERRORS.empty],
    [" \n\t ", COMMENT_ERRORS.empty],
    ["가".repeat(1001), COMMENT_ERRORS.tooLong],
  ])("%j → 오류", (raw, error) => expect(checkComment(raw)).toEqual({ ok: false, error }));
  it("1000자, 이모지는 1자", () => {
    expect(checkComment("가".repeat(1000)).ok).toBe(true);
    expect(checkComment("😀".repeat(1000)).ok).toBe(true);
  });
});

describe("formatDateTime", () => {
  it("한국 시간 24시간", () => {
    expect(formatDateTime(new Date("2026-10-02T05:07:00Z"))).toBe("2026. 10. 02. 14:07");
    expect(formatDateTime(new Date("2026-10-02T15:00:00Z"))).toBe("2026. 10. 03. 00:00");
  });
});
