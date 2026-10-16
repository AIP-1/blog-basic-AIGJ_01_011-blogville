import { describe, expect, it } from "vitest";
import { sheetChars } from "@/lib/sheet";

describe("sheetChars (원고지 제목 칸)", () => {
  it("한글은 음절마다, 띄어쓰기도 한 칸", () => {
    expect(sheetChars("하늘의 여행")).toEqual(["하", "늘", "의", " ", "여", "행"]);
  });

  it("이모지와 조합 글자는 쪼개지 않는다", () => {
    expect(sheetChars("✈️👩‍💻é")).toEqual(["✈️", "👩‍💻", "é"]);
  });

  it("이어 붙이면 원래 제목", () => {
    const title = "Blogville 개발 일지 🍳";
    expect(sheetChars(title).join("")).toBe(title);
  });
});
