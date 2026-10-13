import { describe, expect, it } from "vitest";
import { nextTheme, parseTheme } from "@/lib/theme";

describe("화면 밝기", () => {
  it("저장된 값이 이상하면 기기 설정", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("blue")).toBe("system");
  });
  it("기기 설정 → 어둡게 → 밝게 → 기기 설정", () => {
    expect(nextTheme("system")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
    expect(nextTheme("light")).toBe("system");
  });
});
