import { describe, expect, it } from "vitest";
import { checkBlogIntro, checkBlogTitle, checkNickname } from "@/lib/blog-rules";
import { checkCategoryName } from "@/lib/category-rules";

describe("블로그 이름", () => {
  it("공백뿐이면 거부", () => expect(checkBlogTitle("   ")).toBe("블로그 이름을 적어 주세요"));
  it("40자는 되고 41자는 안 된다", () => {
    expect(checkBlogTitle("가".repeat(40))).toBeNull();
    expect(checkBlogTitle("가".repeat(41))).toBe("블로그 이름은 40자까지예요");
  });
  it("이모지는 1자로 센다", () => expect(checkBlogTitle("😀".repeat(40))).toBeNull());
  it("앞뒤 공백은 세지 않는다", () => expect(checkBlogTitle(`  ${"가".repeat(40)}  `)).toBeNull());
});

describe("소개·닉네임·카테고리", () => {
  it("소개 160자까지", () => {
    expect(checkBlogIntro("a".repeat(160))).toBeNull();
    expect(checkBlogIntro("a".repeat(161))).toBe("소개는 160자까지예요");
  });
  it("닉네임 2~20자", () => {
    expect(checkNickname(" a ")).toBe("닉네임은 2자 이상이에요");
    expect(checkNickname("a".repeat(21))).toBe("닉네임은 20자까지예요");
    expect(checkNickname("창근")).toBeNull();
  });
  it("카테고리 1~20자", () => {
    expect(checkCategoryName(" ")).toBe("카테고리 이름을 적어 주세요");
    expect(checkCategoryName("a".repeat(21))).toBe("카테고리 이름은 20자까지예요");
    expect(checkCategoryName("여행")).toBeNull();
  });
});
