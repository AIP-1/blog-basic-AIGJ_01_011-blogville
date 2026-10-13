import { describe, expect, it } from "vitest";
import { canThumb, thumbUrl, thumbWidthOf } from "@/lib/attachments";

describe("사진 썸네일 규칙", () => {
  it("정해진 너비만 썸네일로 받는다", () => {
    expect(thumbWidthOf("96")).toBe(96);
    expect(thumbWidthOf("320")).toBe(320);
    expect(thumbWidthOf("640")).toBe(640);
    expect(thumbWidthOf("100")).toBeNull();
    expect(thumbWidthOf("")).toBeNull();
    expect(thumbWidthOf(null)).toBeNull();
    expect(thumbWidthOf("320abc")).toBeNull();
  });

  it("움직이는 gif는 줄이지 않는다", () => {
    expect(canThumb("image/jpeg")).toBe(true);
    expect(canThumb("image/png")).toBe(true);
    expect(canThumb("image/webp")).toBe(true);
    expect(canThumb("image/gif")).toBe(false);
    expect(canThumb("application/pdf")).toBe(false);
  });

  it("우리 저장소 사진 주소에만 너비를 붙인다", () => {
    const key = "0123456789abcdef0123456789abcdef";
    expect(thumbUrl(`/files/${key}`, 320)).toBe(`/files/${key}?w=320`);
    expect(thumbUrl("https://example.com/a.png", 320)).toBe("https://example.com/a.png");
  });
});
