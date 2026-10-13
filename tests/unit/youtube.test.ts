import { describe, expect, it } from "vitest";
import { youtubeId } from "@/lib/youtube";

describe("youtubeId", () => {
  it("보기·공유·쇼츠·임베드 주소", () => {
    for (const u of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ])
      expect(youtubeId(u)).toBe("dQw4w9WgXcQ");
  });
  it("다른 사이트·이상한 ID는 null", () => {
    for (const u of ["https://evil.com/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.com/embed/dQw4w9WgXcQ", "https://youtu.be/short", "javascript:alert(1)", "https://www.youtube.com/watch?v=dQw4w9WgXcQ%22"])
      expect(youtubeId(u)).toBeNull();
  });
});
